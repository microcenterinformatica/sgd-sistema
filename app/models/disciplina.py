from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class Disciplina(SQLModel, table=True):
    __tablename__ = "disciplina"
    __table_args__ = (
        UniqueConstraint("escola_id", "nome", name="uq_disciplina_escola_nome"),
        UniqueConstraint("escola_id", "id", name="uq_disciplina_escola_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(foreign_key="escola.id", index=True)
    nome: str
    ativo: bool = Field(default=True)
    eh_especialista: bool = Field(default=False)
