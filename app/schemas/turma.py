from typing import Optional

from sqlmodel import SQLModel

from app.models.turma import SegmentoTurma


class TurmaCreate(SQLModel):
    nome: str
    segmento: SegmentoTurma = SegmentoTurma.fundamental_2


class TurmaUpdate(SQLModel):
    nome: Optional[str] = None
    ativo: Optional[bool] = None
    segmento: Optional[SegmentoTurma] = None


class TurmaRead(SQLModel):
    id: int
    escola_id: int
    nome: str
    ativo: bool
    segmento: SegmentoTurma
