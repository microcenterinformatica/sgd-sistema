from datetime import date
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class MatriculaTurma(SQLModel, table=True):
    __tablename__ = "matricula_turma"
    __table_args__ = (UniqueConstraint("aluno_id", "ano_letivo_id", name="uq_matricula_aluno_ano"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    aluno_id: int = Field(foreign_key="aluno.id", index=True)
    turma_id: int = Field(foreign_key="turma.id", index=True)
    ano_letivo_id: int = Field(foreign_key="ano_letivo.id", index=True)
    numero_chamada: Optional[int] = Field(default=None)
    situacao: str = Field(default="ativa")
    data_entrada: date = Field(default_factory=date.today)
