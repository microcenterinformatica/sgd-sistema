from datetime import date
from typing import Optional

from sqlmodel import Field, SQLModel


class ConteudoAula(SQLModel, table=True):
    """O que o professor lecionou numa turma/disciplina em um dia específico."""

    __tablename__ = "conteudo_aula"

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(index=True)
    professor_id: Optional[int] = Field(default=None, index=True)
    disciplina_id: int = Field(foreign_key="disciplina.id", index=True)
    turma: str = Field(index=True)
    data: date = Field(index=True)
    conteudo: str
    registrado_por_usuario_id: int
