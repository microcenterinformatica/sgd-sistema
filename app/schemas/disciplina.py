from typing import Optional

from sqlmodel import SQLModel


class DisciplinaCreate(SQLModel):
    nome: str


class DisciplinaUpdate(SQLModel):
    nome: Optional[str] = None
    ativo: Optional[bool] = None


class DisciplinaRead(SQLModel):
    id: int
    escola_id: int
    nome: str
    ativo: bool
