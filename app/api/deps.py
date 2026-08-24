from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session

from app.core.security import decodificar_access_token
from app.db.session import get_session
from app.models.usuario import PapelUsuario, Usuario

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

SessionDep = Annotated[Session, Depends(get_session)]


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    session: SessionDep,
) -> Usuario:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar as credenciais",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decodificar_access_token(token)
    if payload is None or "sub" not in payload:
        raise credentials_exception

    usuario = session.get(Usuario, int(payload["sub"]))
    if usuario is None:
        raise credentials_exception

    return usuario


CurrentUserDep = Annotated[Usuario, Depends(get_current_user)]


def require_roles(*papeis: PapelUsuario):
    def checker(usuario: CurrentUserDep) -> Usuario:
        if usuario.papel not in papeis:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem permissão para executar esta ação",
            )
        return usuario

    return checker
