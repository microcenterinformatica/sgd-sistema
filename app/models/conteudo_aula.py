from datetime import date
from typing import Optional

from sqlalchemy import ForeignKeyConstraint
from sqlmodel import Field, SQLModel


class ConteudoAula(SQLModel, table=True):
    """O que o professor lecionou numa turma/disciplina em um dia específico."""

    __tablename__ = "conteudo_aula"
    __table_args__ = (
        ForeignKeyConstraint(
            ["escola_id", "disciplina_id"], ["disciplina.escola_id", "disciplina.id"],
            name="conteudo_aula_disciplina_composta_fkey",
        ),
        ForeignKeyConstraint(
            ["escola_id", "professor_id"], ["professor.escola_id", "professor.id"],
            name="conteudo_aula_professor_composta_fkey",
        ),
        ForeignKeyConstraint(
            ["escola_id", "turma"], ["turma.escola_id", "turma.nome"],
            name="conteudo_aula_turma_fkey",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(foreign_key="escola.id", index=True)
    professor_id: Optional[int] = Field(default=None, index=True)
    disciplina_id: int = Field(index=True)
    turma: str = Field(index=True)
    data: date = Field(index=True)
    conteudo: str
    registrado_por_usuario_id: int = Field(foreign_key="usuario.id")
