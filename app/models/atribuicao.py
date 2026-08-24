from typing import Optional

from sqlmodel import Field, SQLModel


class Atribuicao(SQLModel, table=True):
    """Define que um professor leciona uma disciplina em uma turma."""

    __tablename__ = "atribuicao_professor"

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(index=True)
    professor_id: int = Field(index=True)
    disciplina_id: int = Field(foreign_key="disciplina.id", index=True)
    turma: str = Field(index=True)
