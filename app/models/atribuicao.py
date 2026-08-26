from typing import Optional

from sqlalchemy import ForeignKeyConstraint
from sqlmodel import Field, SQLModel


class Atribuicao(SQLModel, table=True):
    """Define que um professor leciona uma disciplina em uma turma."""

    __tablename__ = "atribuicao_professor"
    __table_args__ = (
        ForeignKeyConstraint(
            ["escola_id", "disciplina_id"], ["disciplina.escola_id", "disciplina.id"],
            name="atribuicao_professor_disciplina_composta_fkey",
        ),
        ForeignKeyConstraint(
            ["escola_id", "professor_id"], ["professor.escola_id", "professor.id"],
            name="atribuicao_professor_professor_composta_fkey",
        ),
        ForeignKeyConstraint(
            ["escola_id", "turma"], ["turma.escola_id", "turma.nome"],
            name="atribuicao_professor_turma_fkey",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(foreign_key="escola.id", index=True)
    professor_id: int = Field(index=True)
    disciplina_id: int = Field(index=True)
    turma: str = Field(index=True)
