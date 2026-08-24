from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlmodel import select

from app.api.deps import SessionDep, require_roles
from app.models.aluno import Aluno
from app.models.configuracao_recuperacao import ConfiguracaoRecuperacao
from app.models.usuario import PapelUsuario
from app.schemas.recuperacao import AlunoRecuperado, RecuperacaoResponse
from app.services.pontuacao import processar_recuperacao_aluno

router = APIRouter(prefix="/recuperacao", tags=["recuperacao"])

GESTAO_ROLES = (PapelUsuario.admin_escola, PapelUsuario.coordenacao)


@router.post("/processar", response_model=RecuperacaoResponse)
def processar_recuperacao(session: SessionDep, usuario_atual=Depends(require_roles(*GESTAO_ROLES))):
    config = session.get(ConfiguracaoRecuperacao, usuario_atual.escola_id)
    if config is None:
        config = ConfiguracaoRecuperacao(escola_id=usuario_atual.escola_id)
        session.add(config)
        session.commit()
        session.refresh(config)

    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    alunos = session.exec(select(Aluno).where(Aluno.escola_id == usuario_atual.escola_id)).all()

    detalhes: list[AlunoRecuperado] = []
    for aluno in alunos:
        pontos_reduzidos = processar_recuperacao_aluno(
            aluno, config.dias_para_recuperacao, config.pontos_recuperacao, agora
        )
        if pontos_reduzidos > 0:
            session.add(aluno)
            detalhes.append(
                AlunoRecuperado(aluno_id=aluno.id, nome=aluno.nome, pontos_reduzidos=pontos_reduzidos)
            )

    session.commit()

    return RecuperacaoResponse(
        total_alunos_recuperados=len(detalhes),
        total_pontos_reduzidos=sum(d.pontos_reduzidos for d in detalhes),
        detalhes=detalhes,
    )
