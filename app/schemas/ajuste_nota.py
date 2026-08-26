from datetime import datetime

from pydantic import Field
from sqlmodel import SQLModel


class AjusteNotaCreate(SQLModel):
    aluno_id: int
    disciplina_id: int
    trimestre: int
    nota_ajustada: float = Field(ge=0, le=10)
    motivo: str


class AjusteNotaRead(SQLModel):
    id: int
    aluno_id: int
    disciplina_id: int
    trimestre: int
    nota_ajustada: float
    motivo: str
    registrado_por_usuario_id: int
    criado_em: datetime
