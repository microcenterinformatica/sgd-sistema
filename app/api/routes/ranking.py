from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlmodel import func, select

from app.api.deps import CurrentUserDep, SessionDep, require_roles
from app.core.permissoes import verificar_permissao_turma
from app.core.tempo import para_horario_local
from app.models.aluno import Aluno
from app.models.atividade import Atividade
from app.models.configuracao_ranking import ConfiguracaoRanking
from app.models.disciplina import Disciplina
from app.models.escola import Escola
from app.models.lancamento import Lancamento
from app.models.professor import Professor
from app.models.registro_disciplinar import RegistroDisciplinar, TipoRegistro
from app.models.registro_falta import RegistroFalta
from app.models.usuario import PapelUsuario, Usuario
from app.schemas.ranking import (
    ConfiguracaoRankingRead,
    ConfiguracaoRankingUpdate,
    ExtratoPontuacao,
    ExtratoPontuacaoItem,
    RankingItem,
)
from app.services.ranking_pdf import gerar_pdf_ranking_turma

router = APIRouter(tags=["ranking"])

TOPS_VALIDOS = (3, 5, 10, 15)

GESTAO_ROLES = (PapelUsuario.admin_escola, PapelUsuario.coordenacao)


@router.get("/configuracao-ranking", response_model=ConfiguracaoRankingRead)
def obter_configuracao_ranking(session: SessionDep, usuario_atual: CurrentUserDep):
    config = session.get(ConfiguracaoRanking, usuario_atual.escola_id)
    if config is None:
        config = ConfiguracaoRanking(escola_id=usuario_atual.escola_id)
    return config


@router.put(
    "/configuracao-ranking",
    response_model=ConfiguracaoRankingRead,
    dependencies=[Depends(require_roles(*GESTAO_ROLES))],
)
def atualizar_configuracao_ranking(
    dados: ConfiguracaoRankingUpdate, session: SessionDep, usuario_atual: CurrentUserDep
):
    if dados.nome_moeda is not None and not dados.nome_moeda.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nome da moeda não pode ficar em branco.")

    config = session.get(ConfiguracaoRanking, usuario_atual.escola_id)
    if config is None:
        config = ConfiguracaoRanking(escola_id=usuario_atual.escola_id)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        if campo == "nome_moeda":
            valor = valor.strip()
        setattr(config, campo, valor)
    session.add(config)
    session.commit()
    session.refresh(config)
    return config


def _somar_peso_por_tipo(session: SessionDep, escola_id: int, tipo: TipoRegistro) -> dict[int, int]:
    linhas = session.exec(
        select(RegistroDisciplinar.aluno_id, func.sum(RegistroDisciplinar.peso))
        .join(Aluno, Aluno.id == RegistroDisciplinar.aluno_id)
        .where(Aluno.escola_id == escola_id, RegistroDisciplinar.tipo == tipo)
        .group_by(RegistroDisciplinar.aluno_id)
    ).all()
    return dict(linhas)


def _contar_nao_entregas(session: SessionDep, escola_id: int) -> dict[int, int]:
    linhas = session.exec(
        select(Lancamento.aluno_id, func.count())
        .join(Aluno, Aluno.id == Lancamento.aluno_id)
        .join(Atividade, Atividade.id == Lancamento.atividade_id)
        .where(
            Aluno.escola_id == escola_id,
            Atividade.ativo == True,  # noqa: E712
            Lancamento.fez == False,  # noqa: E712
        )
        .group_by(Lancamento.aluno_id)
    ).all()
    return dict(linhas)


def _montar_ranking(session: SessionDep, escola_id: int) -> list[RankingItem]:
    alunos = session.exec(select(Aluno).where(Aluno.escola_id == escola_id)).all()

    infracao_por_aluno = _somar_peso_por_tipo(session, escola_id, TipoRegistro.infracao)
    merito_bruto_por_aluno = _somar_peso_por_tipo(session, escola_id, TipoRegistro.merito)

    faltas_por_aluno = dict(
        session.exec(
            select(RegistroFalta.aluno_id, func.count())
            .where(RegistroFalta.escola_id == escola_id, RegistroFalta.justificada == False)  # noqa: E712
            .group_by(RegistroFalta.aluno_id)
        ).all()
    )
    nao_entregas_por_aluno = _contar_nao_entregas(session, escola_id)

    config = session.get(ConfiguracaoRanking, escola_id)
    peso_falta = config.peso_falta if config else 1.0
    peso_nao_entrega = config.peso_nao_entrega if config else 0.0

    resultado: list[RankingItem] = []
    for aluno in alunos:
        total_merito = -merito_bruto_por_aluno.get(aluno.id, 0)
        total_infracao = infracao_por_aluno.get(aluno.id, 0)
        faltas = faltas_por_aluno.get(aluno.id, 0)
        nao_entregas = nao_entregas_por_aluno.get(aluno.id, 0)
        pontuacao = total_merito - total_infracao - peso_falta * faltas - peso_nao_entrega * nao_entregas
        resultado.append(
            RankingItem(
                aluno_id=aluno.id,
                aluno_nome=aluno.nome,
                turma=aluno.turma,
                total_merito=total_merito,
                total_infracao=total_infracao,
                faltas_nao_justificadas=faltas,
                atividades_nao_entregues=nao_entregas,
                pontuacao=round(pontuacao, 2),
            )
        )

    return resultado


def _ordenar_com_posicao_compartilhada(itens: list[RankingItem]) -> list[tuple[RankingItem, int]]:
    """Pontuação igual = mesma posição, próxima pula (1º, 1º, 3º) — mesma regra do frontend."""
    ordenada = sorted(itens, key=lambda i: i.pontuacao, reverse=True)
    resultado: list[tuple[RankingItem, int]] = []
    posicao_atual = 0
    pontuacao_anterior: float | None = None
    for idx, item in enumerate(ordenada):
        if pontuacao_anterior is None or item.pontuacao != pontuacao_anterior:
            posicao_atual = idx + 1
            pontuacao_anterior = item.pontuacao
        resultado.append((item, posicao_atual))
    return resultado


@router.get("/ranking", response_model=list[RankingItem])
def calcular_ranking(session: SessionDep, usuario_atual: CurrentUserDep):
    return _montar_ranking(session, usuario_atual.escola_id)


def _montar_extratos(session: SessionDep, escola_id: int, alunos: list[Aluno]) -> list[ExtratoPontuacao]:
    """A conta que forma a pontuação de cada aluno, lançamento por lançamento. Usa os
    mesmos filtros de `_montar_ranking`: a soma dos itens é a pontuação."""
    ids = [a.id for a in alunos] or [0]
    resumos = {i.aluno_id: i for i in _montar_ranking(session, escola_id)}
    config = session.get(ConfiguracaoRanking, escola_id) or ConfiguracaoRanking(escola_id=escola_id)
    escola = session.get(Escola, escola_id)
    professores = dict(session.exec(select(Professor.id, Professor.nome).where(Professor.escola_id == escola_id)).all())
    usuarios = dict(session.exec(select(Usuario.id, Usuario.nome).where(Usuario.escola_id == escola_id)).all())
    disciplinas = dict(
        session.exec(select(Disciplina.id, Disciplina.nome).where(Disciplina.escola_id == escola_id)).all()
    )

    meritos: dict[int, list[ExtratoPontuacaoItem]] = defaultdict(list)
    ocorrencias: dict[int, list[ExtratoPontuacaoItem]] = defaultdict(list)
    for r in session.exec(
        select(RegistroDisciplinar)
        .where(RegistroDisciplinar.aluno_id.in_(ids))
        .order_by(RegistroDisciplinar.data_hora.desc(), RegistroDisciplinar.id.desc())
    ).all():
        destino = meritos if r.tipo == TipoRegistro.merito else ocorrencias
        destino[r.aluno_id].append(
            ExtratoPontuacaoItem(
                data=para_horario_local(r.data_hora).date(),
                descricao=r.descricao,
                observacao=r.observacao,
                professor_nome=professores.get(r.professor_id) or usuarios.get(r.registrado_por_usuario_id),
                # Infração é gravada com peso positivo e mérito com negativo; na pontuação é o contrário.
                valor=-r.peso,
            )
        )

    faltas: dict[int, list[ExtratoPontuacaoItem]] = defaultdict(list)
    for f in session.exec(
        select(RegistroFalta)
        .where(
            RegistroFalta.escola_id == escola_id,
            RegistroFalta.aluno_id.in_(ids),
            RegistroFalta.justificada == False,  # noqa: E712
        )
        .order_by(RegistroFalta.data.desc(), RegistroFalta.id.desc())
    ).all():
        faltas[f.aluno_id].append(
            ExtratoPontuacaoItem(
                data=f.data,
                descricao=disciplinas.get(f.disciplina_id, "Falta do dia"),
                observacao=f.observacao,
                valor=-config.peso_falta,
            )
        )

    nao_entregues: dict[int, list[ExtratoPontuacaoItem]] = defaultdict(list)
    for aluno_id, a in session.exec(
        select(Lancamento.aluno_id, Atividade)
        .join(Atividade, Lancamento.atividade_id == Atividade.id)
        .where(
            Lancamento.aluno_id.in_(ids),
            Lancamento.fez == False,  # noqa: E712
            Atividade.ativo == True,  # noqa: E712
        )
    ).all():
        disciplina = disciplinas.get(a.disciplina_id)
        nao_entregues[aluno_id].append(
            ExtratoPontuacaoItem(
                data=a.data_entrega or a.data,
                descricao=f"{a.titulo} ({disciplina})" if disciplina else a.titulo,
                valor=-config.peso_nao_entrega,
            )
        )

    return [
        ExtratoPontuacao(
            **resumos[a.id].model_dump(),
            escola_nome=escola.nome if escola else "",
            matricula=a.matricula,
            nome_moeda=config.nome_moeda,
            peso_falta=config.peso_falta,
            peso_nao_entrega=config.peso_nao_entrega,
            meritos=meritos[a.id],
            ocorrencias=ocorrencias[a.id],
            faltas=faltas[a.id],
            nao_entregues=sorted(nao_entregues[a.id], key=lambda i: i.data, reverse=True),
        )
        for a in alunos
    ]


@router.get("/ranking/extrato/{aluno_id}", response_model=ExtratoPontuacao)
def extrato_da_pontuacao(aluno_id: int, session: SessionDep, usuario_atual: CurrentUserDep):
    """Extrato de um aluno. Professor só vê alunos das turmas dele."""
    aluno = session.get(Aluno, aluno_id)
    if aluno is None or aluno.escola_id != usuario_atual.escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aluno não encontrado.")
    verificar_permissao_turma(session, usuario_atual, aluno.turma)
    return _montar_extratos(session, usuario_atual.escola_id, [aluno])[0]


@router.get("/ranking/extrato-turma", response_model=list[ExtratoPontuacao])
def extratos_da_turma(turma: str, session: SessionDep, usuario_atual: CurrentUserDep):
    """Extratos de todos os alunos da turma (para imprimir de uma vez), na ordem da chamada."""
    verificar_permissao_turma(session, usuario_atual, turma)
    alunos = session.exec(
        select(Aluno).where(Aluno.escola_id == usuario_atual.escola_id, Aluno.turma == turma)
    ).all()
    alunos = sorted(alunos, key=lambda a: (a.numero_chamada is None, a.numero_chamada or 0, a.nome.lower()))
    return _montar_extratos(session, usuario_atual.escola_id, alunos)


@router.get("/ranking/relatorio-top-turma")
def gerar_relatorio_top_turma(
    turma: str,
    session: SessionDep,
    usuario_atual: CurrentUserDep,
    top: Optional[int] = None,
):
    """PDF do Patrimônio Disciplinar de uma turma, pronto pra imprimir/compartilhar.
    Sem `top`: todos os alunos da turma (padrão). Com `top` (3/5/10/15): só os N
    primeiros. Mesma fórmula e mesmo critério de posição compartilhada da tela
    (empate = mesma posição)."""
    if top is not None and top not in TOPS_VALIDOS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quantidade inválida. Use um dos valores: {', '.join(str(t) for t in TOPS_VALIDOS)}.",
        )

    escola = session.get(Escola, usuario_atual.escola_id)
    config = session.get(ConfiguracaoRanking, usuario_atual.escola_id)
    nome_moeda = config.nome_moeda if config else "Veracom"
    itens_turma = [i for i in _montar_ranking(session, usuario_atual.escola_id) if i.turma == turma]
    posicionados = _ordenar_com_posicao_compartilhada(itens_turma)
    itens_relatorio = posicionados if top is None else posicionados[:top]

    pdf_bytes = gerar_pdf_ranking_turma(escola, turma, itens_relatorio, top, nome_moeda)
    sufixo = "todos" if top is None else f"top{top}"
    nome_arquivo = f"patrimonio_disciplinar_turma_{turma}_{sufixo}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nome_arquivo}"'},
    )
