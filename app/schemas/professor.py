from typing import Optional

from sqlmodel import SQLModel


class ProfessorCreate(SQLModel):
    nome: str
    usuario_id: Optional[int] = None


class ProfessorRead(SQLModel):
    id: int
    escola_id: int
    nome: str
    usuario_id: Optional[int]


class ProfessorUpdate(SQLModel):
    nome: Optional[str] = None
    usuario_id: Optional[int] = None
