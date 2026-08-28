from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import func, select

from app.api.deps import SessionDep
from app.core.security import criar_access_token, verificar_senha
from app.models.usuario import Usuario
from app.schemas.auth import Token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: SessionDep,
) -> Token:
    usuario = session.exec(
        select(Usuario).where(func.lower(Usuario.email) == form_data.username.lower())
    ).first()

    if usuario is None or not verificar_senha(form_data.password, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha inválidos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário desativado. Fale com o administrador da escola.",
        )

    access_token = criar_access_token(
        {"sub": str(usuario.id), "escola_id": usuario.escola_id, "papel": usuario.papel.value}
    )
    return Token(access_token=access_token)
