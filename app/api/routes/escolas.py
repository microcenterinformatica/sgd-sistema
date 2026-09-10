from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import CurrentUserDep, SessionDep, require_roles
from app.models.escola import Escola
from app.models.usuario import PapelUsuario
from app.schemas.escola import EscolaRead, EscolaUpdate

router = APIRouter(tags=["escola"])

GESTAO_ROLES = (PapelUsuario.admin_escola, PapelUsuario.coordenacao)


@router.get("/escola", response_model=EscolaRead)
def obter_escola(session: SessionDep, usuario_atual: CurrentUserDep):
    return session.get(Escola, usuario_atual.escola_id)


@router.put("/escola", response_model=EscolaRead, dependencies=[Depends(require_roles(*GESTAO_ROLES))])
def atualizar_escola(dados: EscolaUpdate, session: SessionDep, usuario_atual: CurrentUserDep):
    escola = session.get(Escola, usuario_atual.escola_id)

    if dados.nome is not None:
        nome = dados.nome.strip()
        if not nome:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nome da escola não pode ficar em branco.")
        escola.nome = nome

    session.add(escola)
    session.commit()
    session.refresh(escola)
    return escola
