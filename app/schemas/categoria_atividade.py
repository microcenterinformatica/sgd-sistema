from typing import Optional

from sqlmodel import SQLModel


class CategoriaAtividadeCreate(SQLModel):
    disciplina_id: int
    nome: str
    peso: float


class CategoriaAtividadeUpdate(SQLModel):
    nome: Optional[str] = None
    peso: Optional[float] = None


class CategoriaAtividadeRead(SQLModel):
    id: int
    disciplina_id: int
    nome: str
    peso: float
    ativo: bool
