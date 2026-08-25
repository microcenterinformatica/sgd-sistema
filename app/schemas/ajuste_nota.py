from datetime import datetime

from sqlmodel import SQLModel


class AjusteNotaCreate(SQLModel):
    aluno_id: int
    disciplina_id: int
    trimestre: int
    nota_ajustada: float
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
