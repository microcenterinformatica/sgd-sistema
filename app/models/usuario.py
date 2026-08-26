from enum import Enum
from typing import Optional

from sqlalchemy import Index, text
from sqlmodel import Field, SQLModel


class PapelUsuario(str, Enum):
    admin_escola = "admin_escola"
    coordenacao = "coordenacao"
    professor = "professor"


class Usuario(SQLModel, table=True):
    __tablename__ = "usuario"
    __table_args__ = (
        Index("uq_usuario_email_lower", text("lower(email)"), unique=True),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(foreign_key="escola.id", index=True)
    nome: str
    email: str
    senha_hash: str
    papel: PapelUsuario
    ativo: bool = Field(default=True)
