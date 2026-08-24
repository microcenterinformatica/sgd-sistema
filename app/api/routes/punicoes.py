from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select

from app.api.deps import CurrentUserDep, SessionDep, require_roles
from app.models.punicao import Punicao
from app.models.usuario import PapelUsuario
from app.schemas.punicao import PunicaoCreate, PunicaoRead, PunicaoUpdate

router = APIRouter(prefix="/punicoes", tags=["punicoes"])

GESTAO_ROLES = (PapelUsuario.admin_escola, PapelUsuario.coordenacao)


def _get_punicao_da_escola(session: SessionDep, punicao_id: int, escola_id: int) -> Punicao:
    punicao = session.get(Punicao, punicao_id)
    if punicao is None or punicao.escola_id != escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Punição não encontrada")
    return punicao


@router.post("", response_model=PunicaoRead, status_code=status.HTTP_201_CREATED)
def criar_punicao(dados: PunicaoCreate, session: SessionDep, usuario_atual=Depends(require_roles(*GESTAO_ROLES))):
    punicao = Punicao(escola_id=usuario_atual.escola_id, **dados.model_dump())
    session.add(punicao)
    session.commit()
    session.refresh(punicao)
    return punicao


@router.get("", response_model=list[PunicaoRead])
def listar_punicoes(session: SessionDep, usuario_atual: CurrentUserDep):
    return session.exec(select(Punicao).where(Punicao.escola_id == usuario_atual.escola_id)).all()


@router.get("/{punicao_id}", response_model=PunicaoRead)
def obter_punicao(punicao_id: int, session: SessionDep, usuario_atual: CurrentUserDep):
    return _get_punicao_da_escola(session, punicao_id, usuario_atual.escola_id)


@router.put("/{punicao_id}", response_model=PunicaoRead)
def atualizar_punicao(
    punicao_id: int,
    dados: PunicaoUpdate,
    session: SessionDep,
    usuario_atual=Depends(require_roles(*GESTAO_ROLES)),
):
    punicao = _get_punicao_da_escola(session, punicao_id, usuario_atual.escola_id)

    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(punicao, campo, valor)

    session.add(punicao)
    session.commit()
    session.refresh(punicao)
    return punicao


@router.delete("/{punicao_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_punicao(punicao_id: int, session: SessionDep, usuario_atual=Depends(require_roles(*GESTAO_ROLES))):
    punicao = _get_punicao_da_escola(session, punicao_id, usuario_atual.escola_id)
    session.delete(punicao)
    session.commit()
