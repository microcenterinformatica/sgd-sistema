from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select

from app.api.deps import CurrentUserDep, SessionDep, require_roles
from app.models.regra_infracao import RegraInfracao
from app.models.usuario import PapelUsuario
from app.schemas.regra_infracao import RegraInfracaoCreate, RegraInfracaoRead, RegraInfracaoUpdate

router = APIRouter(prefix="/regras", tags=["regras"])

GESTAO_ROLES = (PapelUsuario.admin_escola, PapelUsuario.coordenacao)


def _get_regra_da_escola(session: SessionDep, regra_id: int, escola_id: int) -> RegraInfracao:
    regra = session.get(RegraInfracao, regra_id)
    if regra is None or regra.escola_id != escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Regra não encontrada")
    return regra


@router.post("", response_model=RegraInfracaoRead, status_code=status.HTTP_201_CREATED)
def criar_regra(dados: RegraInfracaoCreate, session: SessionDep, usuario_atual=Depends(require_roles(*GESTAO_ROLES))):
    regra = RegraInfracao(escola_id=usuario_atual.escola_id, **dados.model_dump())
    session.add(regra)
    session.commit()
    session.refresh(regra)
    return regra


@router.get("", response_model=list[RegraInfracaoRead])
def listar_regras(session: SessionDep, usuario_atual: CurrentUserDep):
    return session.exec(select(RegraInfracao).where(RegraInfracao.escola_id == usuario_atual.escola_id)).all()


@router.get("/{regra_id}", response_model=RegraInfracaoRead)
def obter_regra(regra_id: int, session: SessionDep, usuario_atual: CurrentUserDep):
    return _get_regra_da_escola(session, regra_id, usuario_atual.escola_id)


@router.put("/{regra_id}", response_model=RegraInfracaoRead)
def atualizar_regra(
    regra_id: int,
    dados: RegraInfracaoUpdate,
    session: SessionDep,
    usuario_atual=Depends(require_roles(*GESTAO_ROLES)),
):
    regra = _get_regra_da_escola(session, regra_id, usuario_atual.escola_id)

    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(regra, campo, valor)

    session.add(regra)
    session.commit()
    session.refresh(regra)
    return regra


@router.delete("/{regra_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_regra(regra_id: int, session: SessionDep, usuario_atual=Depends(require_roles(*GESTAO_ROLES))):
    regra = _get_regra_da_escola(session, regra_id, usuario_atual.escola_id)
    session.delete(regra)
    session.commit()
