from datetime import date
from typing import Optional

from sqlmodel import Field, SQLModel


class RegistroFalta(SQLModel, table=True):
    __tablename__ = "registro_falta"

    id: Optional[int] = Field(default=None, primary_key=True)
    aluno_id: int = Field(index=True)
    escola_id: int = Field(index=True)
    disciplina_id: Optional[int] = Field(default=None, foreign_key="disciplina.id", index=True)
    data: date
    justificada: bool = Field(default=False)
    observacao: Optional[str] = Field(default=None)
    registrado_por_usuario_id: int
