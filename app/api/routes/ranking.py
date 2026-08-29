from fastapi import APIRouter, Depends
from sqlmodel import func, select

from app.api.deps import CurrentUserDep, SessionDep, require_roles
from app.models.aluno import Aluno
from app.models.atividade import Atividade
from app.models.configuracao_ranking import ConfiguracaoRanking
from app.models.lancamento import Lancamento
from app.models.registro_disciplinar import RegistroDisciplinar, TipoRegistro
from app.models.registro_falta import RegistroFalta
from app.models.usuario import PapelUsuario
from app.schemas.ranking import ConfiguracaoRankingRead, ConfiguracaoRankingUpdate, RankingItem

router = APIRouter(tags=["ranking"])

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
    config = session.get(ConfiguracaoRanking, usuario_atual.escola_id)
    if config is None:
        config = ConfiguracaoRanking(escola_id=usuario_atual.escola_id)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
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


@router.get("/ranking", response_model=list[RankingItem])
def calcular_ranking(session: SessionDep, usuario_atual: CurrentUserDep):
    escola_id = usuario_atual.escola_id
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
