from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class Turma(SQLModel, table=True):
    __tablename__ = "turma"
    __table_args__ = (UniqueConstraint("escola_id", "nome", name="uq_turma_escola_nome"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(index=True)
    nome: str
    ativo: bool = Field(default=True)
