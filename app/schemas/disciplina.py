from typing import Optional

from sqlmodel import SQLModel


class DisciplinaCreate(SQLModel):
    nome: str
    eh_especialista: bool = False


class DisciplinaUpdate(SQLModel):
    nome: Optional[str] = None
    ativo: Optional[bool] = None
    eh_especialista: Optional[bool] = None


class DisciplinaRead(SQLModel):
    id: int
    escola_id: int
    nome: str
    ativo: bool
    eh_especialista: bool
