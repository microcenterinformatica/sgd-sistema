from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from app.api.deps import CurrentUserDep, SessionDep
from app.core.permissoes import falta_agrupada_por_dia, verificar_permissao_turma_disciplina
from app.core.tempo import FUSO_BRASIL, para_horario_local
from app.models.ajuste_nota import AjusteNota
from app.models.aluno import Aluno
from app.models.atividade import Atividade
from app.models.atribuicao import Atribuicao
from app.models.categoria_atividade import CategoriaAtividade, TipoCategoria
from app.models.configuracao_periodo import ConfiguracaoPeriodo
from app.models.disciplina import Disciplina
from app.models.lancamento import Lancamento
from app.models.registro_disciplinar import RegistroDisciplinar
from app.models.registro_falta import RegistroFalta
from app.schemas.ajuste_nota import AjusteNotaCreate, AjusteNotaRead
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
    turma: str,
    disciplina_id: int,
    aluno_ids: list[int],
    data_inicio: date | None,
    data_fim: date | None,
) -> dict[int, tuple[int, int]]:
    """Retorna, por aluno_id, (total_faltas, faltas_justificadas) no período.

    Em disciplinas do professor regente, em turmas Fundamental 1, a falta é registrada
    uma vez por dia (vale para todas as disciplinas dele), então aqui ela é contada por
    `disciplina_id IS NULL` em vez de casar com a disciplina específica. Disciplinas de
    especialista (Inglês, Arte, Educação Física etc.) continuam contadas só por elas
    mesmas, mesmo em turma Fundamental 1.
    """
    if not aluno_ids:
        return {}
    agrupa = falta_agrupada_por_dia(session, escola_id, turma, disciplina_id)
    filtro_disciplina = RegistroFalta.disciplina_id.is_(None) if agrupa else RegistroFalta.disciplina_id == disciplina_id
    query = select(RegistroFalta).where(
        RegistroFalta.escola_id == escola_id,
        filtro_disciplina,
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


def _buscar_ajustes(
    session: SessionDep, disciplina_id: int, trimestre: int | None, aluno_ids: list[int]
) -> dict[int, AjusteNota]:
    if trimestre is None or not aluno_ids:
        return {}
    ajustes = session.exec(
        select(AjusteNota).where(
            AjusteNota.disciplina_id == disciplina_id,
            AjusteNota.trimestre == trimestre,
            AjusteNota.aluno_id.in_(aluno_ids),
        )
    ).all()
    return {a.aluno_id: a for a in ajustes}


def _inicio_do_dia_local_em_utc(dia: date) -> datetime:
    """Meia-noite de Brasília do dia informado, convertida pro UTC naive usado no banco."""
    return datetime.combine(dia, time.min, tzinfo=FUSO_BRASIL).astimezone(timezone.utc).replace(tzinfo=None)


def _buscar_categorias_conduta(
    session: SessionDep, escola_id: int, turma: str, disciplina_id: int, data_inicio: date | None
) -> list[CategoriaAtividade]:
    """Categorias de conduta dos professores que lecionam a disciplina nesta turma.

    Período que ainda não começou (ex: 3º trimestre em agosto) fica sem nota de conduta,
    senão o aluno já "ganharia" 10 num trimestre em que nem houve aula.
    """
    hoje = para_horario_local(datetime.now(timezone.utc)).date()
    if data_inicio is not None and data_inicio > hoje:
        return []
    professor_ids = session.exec(
        select(Atribuicao.professor_id).where(
            Atribuicao.escola_id == escola_id,
            Atribuicao.turma == turma,
            Atribuicao.disciplina_id == disciplina_id,
        )
    ).all()
    if not professor_ids:
        return []
    return session.exec(
        select(CategoriaAtividade).where(
            CategoriaAtividade.escola_id == escola_id,
            CategoriaAtividade.disciplina_id == disciplina_id,
            CategoriaAtividade.professor_id.in_(professor_ids),
            CategoriaAtividade.tipo == TipoCategoria.conduta,
            CategoriaAtividade.ativo == True,  # noqa: E712
        )
    ).all()


def _buscar_registros_conduta(
    session: SessionDep, aluno_ids: list[int], data_inicio: date | None, data_fim: date | None
) -> dict[int, list[RegistroDisciplinar]]:
    """Indisciplinas e méritos lançados por pessoas no período, em ordem cronológica.

    Registros automáticos do sistema (recuperação de pontos e bônus de bom comportamento,
    sem `registrado_por_usuario_id`) ficam de fora: a nota de conduta já parte de 10 a
    cada trimestre, então devolver pontos só pela passagem do tempo apagaria a indisciplina.
    """
    if not aluno_ids:
        return {}
    query = select(RegistroDisciplinar).where(
        RegistroDisciplinar.aluno_id.in_(aluno_ids),
        RegistroDisciplinar.registrado_por_usuario_id.is_not(None),
    )
    if data_inicio:
        query = query.where(RegistroDisciplinar.data_hora >= _inicio_do_dia_local_em_utc(data_inicio))
    if data_fim:
        query = query.where(
            RegistroDisciplinar.data_hora < _inicio_do_dia_local_em_utc(data_fim + timedelta(days=1))
        )
    query = query.order_by(RegistroDisciplinar.data_hora, RegistroDisciplinar.id)
    por_aluno: dict[int, list[RegistroDisciplinar]] = {}
    for r in session.exec(query).all():
        por_aluno.setdefault(r.aluno_id, []).append(r)
    return por_aluno


def calcular_nota_conduta(registros: list[RegistroDisciplinar], desconto_por_ponto: float) -> float:
    """Começa em 10; cada ponto de indisciplina desconta `desconto_por_ponto` e cada ponto
    de mérito devolve o mesmo valor, sempre dentro de 0 a 10. Aplicado em ordem
    cronológica, então mérito recebido com a nota já cheia não vira "crédito" para
    indisciplinas futuras. Mérito de turma removido (peso positivo) desconta.
    """
    nota = 10.0
    for r in registros:
        # Infração grava peso positivo; mérito grava negativo (ver registros.py).
        nota = min(10.0, max(0.0, nota - r.peso * desconto_por_ponto))
    return nota


def _calcular_boletim(
    session: SessionDep,
    escola_id: int,
    turma: str,
    disciplina_id: int,
    data_inicio: date | None,
    data_fim: date | None,
    aluno_id: int | None = None,
    trimestre: int | None = None,
) -> list[BoletimAluno]:
    """Nota final do período numa disciplina: agrupa atividades e provas pela categoria
    cadastrada (ex: "Tarefa de casa", "Atividade em sala"), tira a média do aluno em cada
    grupo (lançamentos ausentes contam nota 0) e converte a média em pontos (media / 10 *
    peso da categoria). A soma dos pontos de todos os grupos é a nota final; a soma dos
    pesos é o total máximo possível. O peso de cada categoria vem sempre do cadastro dela
    (CategoriaAtividade), nunca da atividade individual — por isso categorias diferentes
    nunca se misturam, mesmo que tenham o mesmo peso. Categorias de conduta entram como um
    grupo a mais, com a nota calculada pelos registros disciplinares do período
    (`calcular_nota_conduta`), sem atividades.
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
        session, escola_id, turma, disciplina_id, [a.id for a in alunos], data_inicio, data_fim
    )
    ajustes_por_aluno = _buscar_ajustes(session, disciplina_id, trimestre, [a.id for a in alunos])

    atividades_por_categoria: dict[int, list[Atividade]] = {}
    for a in atividades:
        atividades_por_categoria.setdefault(a.categoria_id, []).append(a)

    categorias = (
        {
            c.id: c
            for c in session.exec(
                select(CategoriaAtividade).where(CategoriaAtividade.id.in_(atividades_por_categoria.keys()))
            ).all()
        }
        if atividades_por_categoria
        else {}
    )

    atividade_ids = [a.id for a in atividades]
    lancamentos = (
        session.exec(select(Lancamento).where(Lancamento.atividade_id.in_(atividade_ids))).all()
        if atividade_ids
        else []
    )
    nota_por_atividade_aluno: dict[tuple[int, int], float] = {
        (l.atividade_id, l.aluno_id): l.nota for l in lancamentos if l.nota is not None
    }

    categorias_conduta = _buscar_categorias_conduta(session, escola_id, turma, disciplina_id, data_inicio)
    registros_conduta = (
        _buscar_registros_conduta(session, [a.id for a in alunos], data_inicio, data_fim)
        if categorias_conduta
        else {}
    )

    resultado: list[BoletimAluno] = []
    for aluno in alunos:
        grupos: list[BoletimGrupoPeso] = []
        nota_calculada = 0.0
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
            nota_calculada += pontos
            peso_total += categoria.peso

        registros_aluno = registros_conduta.get(aluno.id, [])
        for categoria in sorted(categorias_conduta, key=lambda c: c.nome.lower()):
            nota_conduta = calcular_nota_conduta(registros_aluno, categoria.desconto_por_ponto or 0.5)
            pontos = nota_conduta / 10 * categoria.peso
            grupos.append(
                BoletimGrupoPeso(
                    categoria=categoria.nome,
                    peso=categoria.peso,
                    quantidade_atividades=0,
                    media=round(nota_conduta, 2),
                    pontos=round(pontos, 2),
                    automatica=True,
                    quantidade_ocorrencias=len(registros_aluno),
                )
            )
            nota_calculada += pontos
            peso_total += categoria.peso

        ajuste = ajustes_por_aluno.get(aluno.id)
        nota_ajustada = ajuste.nota_ajustada if ajuste else None
        nota_efetiva = nota_ajustada if nota_ajustada is not None else nota_calculada

        total_faltas, faltas_justificadas = faltas_por_aluno.get(aluno.id, (0, 0))
        resultado.append(
            BoletimAluno(
                aluno_id=aluno.id,
                aluno_nome=aluno.nome,
                grupos=grupos,
                peso_total=round(peso_total, 2),
                nota_calculada=round(nota_calculada, 2),
                nota_final=round(nota_efetiva, 2),
                nota_ajustada=round(nota_ajustada, 2) if nota_ajustada is not None else None,
                ajuste_motivo=ajuste.motivo if ajuste else None,
                ajuste_id=ajuste.id if ajuste else None,
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
    trimestre: int | None = None,
):
    return _calcular_boletim(
        session, usuario_atual.escola_id, turma, disciplina_id, data_inicio, data_fim, aluno_id, trimestre
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
                session, usuario_atual.escola_id, turma, disciplina.id, inicio, fim, aluno_id, numero
            )
            boletim_aluno = boletins[0]
            trimestres.append(
                BoletimTrimestre(
                    trimestre=numero,
                    data_inicio=inicio,
                    data_fim=fim,
                    grupos=boletim_aluno.grupos,
                    peso_total=boletim_aluno.peso_total,
                    nota_calculada=boletim_aluno.nota_calculada,
                    nota_final=boletim_aluno.nota_final,
                    nota_ajustada=boletim_aluno.nota_ajustada,
                    ajuste_motivo=boletim_aluno.ajuste_motivo,
                    ajuste_id=boletim_aluno.ajuste_id,
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


def _get_aluno_para_ajuste(session: SessionDep, aluno_id: int, escola_id: int) -> Aluno:
    aluno = session.get(Aluno, aluno_id)
    if aluno is None or aluno.escola_id != escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aluno não encontrado")
    if not aluno.turma:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Aluno sem turma cadastrada")
    return aluno


@router.put("/boletim/ajuste", response_model=AjusteNotaRead)
def registrar_ajuste_nota(dados: AjusteNotaCreate, session: SessionDep, usuario_atual: CurrentUserDep):
    if dados.trimestre not in (1, 2, 3):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trimestre deve ser 1, 2 ou 3")
    if not dados.motivo.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o motivo do ajuste")

    aluno = _get_aluno_para_ajuste(session, dados.aluno_id, usuario_atual.escola_id)
    verificar_permissao_turma_disciplina(session, usuario_atual, aluno.turma, dados.disciplina_id)

    ajuste = session.exec(
        select(AjusteNota).where(
            AjusteNota.aluno_id == dados.aluno_id,
            AjusteNota.disciplina_id == dados.disciplina_id,
            AjusteNota.trimestre == dados.trimestre,
        )
    ).first()

    if ajuste is None:
        ajuste = AjusteNota(escola_id=usuario_atual.escola_id, registrado_por_usuario_id=usuario_atual.id)

    ajuste.aluno_id = dados.aluno_id
    ajuste.disciplina_id = dados.disciplina_id
    ajuste.trimestre = dados.trimestre
    ajuste.nota_ajustada = dados.nota_ajustada
    ajuste.motivo = dados.motivo.strip()
    ajuste.registrado_por_usuario_id = usuario_atual.id
    ajuste.criado_em = datetime.utcnow()

    session.add(ajuste)
    session.commit()
    session.refresh(ajuste)
    return ajuste


@router.delete("/boletim/ajuste/{ajuste_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_ajuste_nota(ajuste_id: int, session: SessionDep, usuario_atual: CurrentUserDep):
    ajuste = session.get(AjusteNota, ajuste_id)
    if ajuste is None or ajuste.escola_id != usuario_atual.escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ajuste não encontrado")

    aluno = _get_aluno_para_ajuste(session, ajuste.aluno_id, usuario_atual.escola_id)
    verificar_permissao_turma_disciplina(session, usuario_atual, aluno.turma, ajuste.disciplina_id)

    session.delete(ajuste)
    session.commit()
