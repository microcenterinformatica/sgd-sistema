from fastapi import APIRouter

from app.api.deps import CurrentUserDep, SessionDep
from app.models.configuracao_periodo import ConfiguracaoPeriodo
from app.schemas.configuracao_periodo import ConfiguracaoPeriodoRead, ConfiguracaoPeriodoUpdate

router = APIRouter(tags=["configuracao-periodo"])


@router.get("/configuracao-periodo", response_model=ConfiguracaoPeriodoRead)
def obter_configuracao_periodo(session: SessionDep, usuario_atual: CurrentUserDep):
    config = session.get(ConfiguracaoPeriodo, usuario_atual.escola_id)
    if config is None:
        config = ConfiguracaoPeriodo(escola_id=usuario_atual.escola_id)
    return config


@router.put("/configuracao-periodo", response_model=ConfiguracaoPeriodoRead)
def atualizar_configuracao_periodo(
    dados: ConfiguracaoPeriodoUpdate, session: SessionDep, usuario_atual: CurrentUserDep
):
    config = session.get(ConfiguracaoPeriodo, usuario_atual.escola_id)
    if config is None:
        config = ConfiguracaoPeriodo(escola_id=usuario_atual.escola_id)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(config, campo, valor)
    session.add(config)
    session.commit()
    session.refresh(config)
    return config
