from typing import Optional

from sqlmodel import SQLModel

from app.models.usuario import PapelUsuario


class UsuarioCreate(SQLModel):
    nome: str
    email: str
    senha: str
    papel: PapelUsuario


class UsuarioRead(SQLModel):
    id: int
    escola_id: int
    nome: str
    email: str
    papel: PapelUsuario
    ativo: bool


class UsuarioUpdate(SQLModel):
    nome: Optional[str] = None
    senha: Optional[str] = None
    papel: Optional[PapelUsuario] = None
    ativo: Optional[bool] = None
