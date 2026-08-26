from typing import Optional

from pydantic import Field
from sqlmodel import SQLModel


class PunicaoCreate(SQLModel):
    descricao: str
    pontuacao_minima: int = Field(ge=0)


class PunicaoRead(SQLModel):
    id: int
    escola_id: int
    descricao: str
    pontuacao_minima: int
    ativo: bool


class PunicaoUpdate(SQLModel):
    descricao: Optional[str] = None
    pontuacao_minima: Optional[int] = Field(default=None, ge=0)
    ativo: Optional[bool] = None
