from typing import Optional

from sqlmodel import SQLModel


class TurmaCreate(SQLModel):
    nome: str


class TurmaUpdate(SQLModel):
    nome: Optional[str] = None
    ativo: Optional[bool] = None


class TurmaRead(SQLModel):
    id: int
    escola_id: int
    nome: str
    ativo: bool
