from datetime import date

from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from app.api.deps import CurrentUserDep, SessionDep
from app.models.aluno import Aluno
from app.models.atividade import Atividade
from app.models.atribuicao import Atribuicao
from app.models.categoria_atividade import CategoriaAtividade
from app.models.configuracao_periodo import ConfiguracaoPeriodo
from app.models.disciplina import Disciplina
from app.models.lancamento import Lancamento
from app.models.registro_falta import RegistroFalta
from app.schemas.boletim import (
    BoletimAluno,
    BoletimAnualAluno,
    BoletimDisciplinaAnual,
    BoletimGrupoPeso,
    BoletimTrimestre,
)

router = APIRouter(tags=["boletim"])


def _listar_alunos_por_turma(session: SessionDep, escola_id: int, turma: str | None) -> list[Aluno]:
    query = select(Aluno).where(Aluno.escola_id == escola_id)
    if turma:
        query = query.where(Aluno.turma == turma)
    query = query.order_by(Aluno.numero_chamada.is_(None), Aluno.numero_chamada, Aluno.nome)
    return session.exec(query).all()


def _contar_faltas(
    session: SessionDep,
    escola_id: int,
    disciplina_id: int,
    aluno_ids: list[int],
    data_inicio: date | None,
    data_fim: date | None,
) -> dict[int, tuple[int, int]]:
    """Retorna, por aluno_id, (total_faltas, faltas_justificadas) no período, numa disciplina."""
    if not aluno_ids:
        return {}
    query = select(RegistroFalta).where(
        RegistroFalta.escola_id == escola_id,
        RegistroFalta.disciplina_id == disciplina_id,
        RegistroFalta.aluno_id.in_(aluno_ids),
    )
    if data_inicio:
        query = query.where(RegistroFalta.data >= data_inicio)
    if data_fim:
        query = query.where(RegistroFalta.data <= data_fim)
    faltas = session.exec(query).all()

    contagem: dict[int, tuple[int, int]] = {}
    for f in faltas:
        total, justificadas = contagem.get(f.aluno_id, (0, 0))
        total += 1
        justificadas += 1 if f.justificada else 0
        contagem[f.aluno_id] = (total, justificadas)
    return contagem


def _calcular_boletim(
    session: SessionDep,
    escola_id: int,
    turma: str,
    disciplina_id: int,
    data_inicio: date | None,
    data_fim: date | None,
    aluno_id: int | None = None,
) -> list[BoletimAluno]:
    """Nota final do período numa disciplina: agrupa atividades e provas pela categoria
    cadastrada (ex: "Tarefa de casa", "Atividade em sala"), tira a média do aluno em cada
    grupo (lançamentos ausentes contam nota 0) e converte a média em pontos (media / 10 *
    peso da categoria). A soma dos pontos de todos os grupos é a nota final; a soma dos
    pesos é o total máximo possível. O peso de cada categoria vem sempre do cadastro dela
    (CategoriaAtividade), nunca da atividade individual — por isso categorias diferentes
    nunca se misturam, mesmo que tenham o mesmo peso.
    """
    query = select(Atividade).where(
        Atividade.escola_id == escola_id,
        Atividade.turma == turma,
        Atividade.disciplina_id == disciplina_id,
        Atividade.ativo == True,  # noqa: E712
    )
    if data_inicio:
        query = query.where(Atividade.data >= data_inicio)
    if data_fim:
        query = query.where(Atividade.data <= data_fim)
    atividades = session.exec(query).all()

    alunos = _listar_alunos_por_turma(session, escola_id, turma)
    if aluno_id is not None:
        alunos = [a for a in alunos if a.id == aluno_id]

    faltas_por_aluno = _contar_faltas(
        session, escola_id, disciplina_id, [a.id for a in alunos], data_inicio, data_fim
    )

    if not atividades:
        return [
            BoletimAluno(
                aluno_id=a.id,
                aluno_nome=a.nome,
                grupos=[],
                peso_total=0.0,
                nota_final=0.0,
                total_faltas=faltas_por_aluno.get(a.id, (0, 0))[0],
                faltas_justificadas=faltas_por_aluno.get(a.id, (0, 0))[1],
            )
            for a in alunos
        ]

    atividades_por_categoria: dict[int, list[Atividade]] = {}
    for a in atividades:
        atividades_por_categoria.setdefault(a.categoria_id, []).append(a)

    categorias = {
        c.id: c
        for c in session.exec(
            select(CategoriaAtividade).where(CategoriaAtividade.id.in_(atividades_por_categoria.keys()))
        ).all()
    }

    atividade_ids = [a.id for a in atividades]
    lancamentos = session.exec(
        select(Lancamento).where(Lancamento.atividade_id.in_(atividade_ids))
    ).all()
    nota_por_atividade_aluno: dict[tuple[int, int], float] = {
        (l.atividade_id, l.aluno_id): l.nota for l in lancamentos if l.nota is not None
    }

    resultado: list[BoletimAluno] = []
    for aluno in alunos:
        grupos: list[BoletimGrupoPeso] = []
        nota_final = 0.0
        peso_total = 0.0
        for categoria_id in sorted(atividades_por_categoria, key=lambda cid: categorias[cid].nome.lower()):
            atividades_da_categoria = atividades_por_categoria[categoria_id]
            categoria = categorias[categoria_id]
            soma_notas = sum(
                nota_por_atividade_aluno.get((a.id, aluno.id), 0.0) for a in atividades_da_categoria
            )
            media = soma_notas / len(atividades_da_categoria)
            pontos = media / 10 * categoria.peso
            grupos.append(
                BoletimGrupoPeso(
                    categoria=categoria.nome,
                    peso=categoria.peso,
                    quantidade_atividades=len(atividades_da_categoria),
                    media=round(media, 2),
                    pontos=round(pontos, 2),
                )
            )
            nota_final += pontos
            peso_total += categoria.peso

        total_faltas, faltas_justificadas = faltas_por_aluno.get(aluno.id, (0, 0))
        resultado.append(
            BoletimAluno(
                aluno_id=aluno.id,
                aluno_nome=aluno.nome,
                grupos=grupos,
                peso_total=round(peso_total, 2),
                nota_final=round(nota_final, 2),
                total_faltas=total_faltas,
                faltas_justificadas=faltas_justificadas,
            )
        )

    return resultado


@router.get("/boletim", response_model=list[BoletimAluno])
def calcular_boletim(
    turma: str,
    disciplina_id: int,
    session: SessionDep,
    usuario_atual: CurrentUserDep,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    aluno_id: int | None = None,
):
    return _calcular_boletim(
        session, usuario_atual.escola_id, turma, disciplina_id, data_inicio, data_fim, aluno_id
    )


@router.get("/boletim-anual", response_model=BoletimAnualAluno)
def calcular_boletim_anual(
    turma: str, aluno_id: int, session: SessionDep, usuario_atual: CurrentUserDep
):
    config = session.get(ConfiguracaoPeriodo, usuario_atual.escola_id)
    trimestres_datas = (
        [
            (1, config.trimestre1_inicio, config.trimestre1_fim),
            (2, config.trimestre2_inicio, config.trimestre2_fim),
            (3, config.trimestre3_inicio, config.trimestre3_fim),
        ]
        if config
        else []
    )
    if len(trimestres_datas) != 3 or any(inicio is None or fim is None for _, inicio, fim in trimestres_datas):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Configure as datas dos 3 trimestres antes de gerar o boletim anual (tela Configurações).",
        )

    alunos = _listar_alunos_por_turma(session, usuario_atual.escola_id, turma)
    aluno = next((a for a in alunos if a.id == aluno_id), None)
    if aluno is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aluno não encontrado nesta turma")

    disciplina_ids_atribuicao = session.exec(
        select(Atribuicao.disciplina_id)
        .where(Atribuicao.escola_id == usuario_atual.escola_id, Atribuicao.turma == turma)
        .distinct()
    ).all()
    disciplina_ids_com_atividade = session.exec(
        select(Atividade.disciplina_id)
        .where(
            Atividade.escola_id == usuario_atual.escola_id,
            Atividade.turma == turma,
            Atividade.ativo == True,  # noqa: E712
        )
        .distinct()
    ).all()
    disciplina_ids = set(disciplina_ids_atribuicao) | set(disciplina_ids_com_atividade)
    disciplinas = session.exec(
        select(Disciplina).where(Disciplina.id.in_(disciplina_ids))
    ).all() if disciplina_ids else []

    resultado_disciplinas: list[BoletimDisciplinaAnual] = []
    for disciplina in sorted(disciplinas, key=lambda d: d.nome):
        trimestres: list[BoletimTrimestre] = []
        notas_finais: list[float] = []
        faltas_disciplina = 0
        for numero, inicio, fim in trimestres_datas:
            boletins = _calcular_boletim(
                session, usuario_atual.escola_id, turma, disciplina.id, inicio, fim, aluno_id
            )
            boletim_aluno = boletins[0]
            trimestres.append(
                BoletimTrimestre(
                    trimestre=numero,
                    data_inicio=inicio,
                    data_fim=fim,
                    grupos=boletim_aluno.grupos,
                    peso_total=boletim_aluno.peso_total,
                    nota_final=boletim_aluno.nota_final,
                    total_faltas=boletim_aluno.total_faltas,
                    faltas_justificadas=boletim_aluno.faltas_justificadas,
                )
            )
            notas_finais.append(boletim_aluno.nota_final)
            faltas_disciplina += boletim_aluno.total_faltas

        media_final = sum(notas_finais) / 3
        resultado_disciplinas.append(
            BoletimDisciplinaAnual(
                disciplina_id=disciplina.id,
                disciplina_nome=disciplina.nome,
                trimestres=trimestres,
                media_final=round(media_final, 2),
                aprovado=media_final >= 6,
                total_faltas=faltas_disciplina,
            )
        )

    return BoletimAnualAluno(
        aluno_id=aluno.id,
        aluno_nome=aluno.nome,
        disciplinas=resultado_disciplinas,
    )
