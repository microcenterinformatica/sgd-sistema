from fastapi import APIRouter, Depends

from app.api.deps import CurrentUserDep, SessionDep, require_roles
from app.models.configuracao_recuperacao import ConfiguracaoRecuperacao
from app.models.usuario import PapelUsuario
from app.schemas.recuperacao import ConfiguracaoRecuperacaoRead, ConfiguracaoRecuperacaoUpdate

router = APIRouter(tags=["recuperacao"])

GESTAO_ROLES = (PapelUsuario.admin_escola, PapelUsuario.coordenacao)


@router.get("/configuracao-recuperacao", response_model=ConfiguracaoRecuperacaoRead)
def obter_configuracao_recuperacao(session: SessionDep, usuario_atual: CurrentUserDep):
    config = session.get(ConfiguracaoRecuperacao, usuario_atual.escola_id)
    if config is None:
        config = ConfiguracaoRecuperacao(escola_id=usuario_atual.escola_id)
    return config


@router.put(
    "/configuracao-recuperacao",
    response_model=ConfiguracaoRecuperacaoRead,
    dependencies=[Depends(require_roles(*GESTAO_ROLES))],
)
def atualizar_configuracao_recuperacao(
    dados: ConfiguracaoRecuperacaoUpdate, session: SessionDep, usuario_atual: CurrentUserDep
):
    config = session.get(ConfiguracaoRecuperacao, usuario_atual.escola_id)
    if config is None:
        config = ConfiguracaoRecuperacao(escola_id=usuario_atual.escola_id)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(config, campo, valor)
    session.add(config)
    session.commit()
    session.refresh(config)
    return config
