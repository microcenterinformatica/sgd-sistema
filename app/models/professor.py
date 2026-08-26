from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class Professor(SQLModel, table=True):
    __tablename__ = "professor"
    __table_args__ = (UniqueConstraint("escola_id", "id", name="uq_professor_escola_id"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(foreign_key="escola.id", index=True)
    nome: str
    usuario_id: Optional[int] = Field(default=None, foreign_key="usuario.id", unique=True)
