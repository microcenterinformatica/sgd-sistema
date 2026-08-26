from typing import Optional

from pydantic import Field
from sqlmodel import SQLModel


class CategoriaAtividadeCreate(SQLModel):
    disciplina_id: int
    nome: str
    peso: float = Field(gt=0)


class CategoriaAtividadeUpdate(SQLModel):
    nome: Optional[str] = None
    peso: Optional[float] = Field(default=None, gt=0)


class CategoriaAtividadeRead(SQLModel):
    id: int
    disciplina_id: int
    nome: str
    peso: float
    ativo: bool
