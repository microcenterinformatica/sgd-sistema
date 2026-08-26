from typing import Optional

from sqlalchemy import CheckConstraint
from sqlmodel import Field, SQLModel


class CategoriaAtividade(SQLModel, table=True):
    __tablename__ = "categoria_atividade"
    __table_args__ = (CheckConstraint("peso > 0", name="ck_categoria_atividade_peso"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(foreign_key="escola.id", index=True)
    professor_id: Optional[int] = Field(default=None, foreign_key="professor.id", index=True)
    disciplina_id: int = Field(foreign_key="disciplina.id", index=True)
    nome: str
    peso: float = Field(gt=0)
    ativo: bool = Field(default=True)
