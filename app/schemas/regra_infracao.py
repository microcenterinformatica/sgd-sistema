from typing import Optional

from pydantic import Field
from sqlmodel import SQLModel


class RegraInfracaoCreate(SQLModel):
    descricao: str
    peso: int = Field(ge=0)


class RegraInfracaoRead(SQLModel):
    id: int
    escola_id: int
    descricao: str
    peso: int
    ativo: bool


class RegraInfracaoUpdate(SQLModel):
    descricao: Optional[str] = None
    peso: Optional[int] = Field(default=None, ge=0)
    ativo: Optional[bool] = None
