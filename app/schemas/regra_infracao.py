from typing import Optional

from sqlmodel import SQLModel


class RegraInfracaoCreate(SQLModel):
    descricao: str
    peso: int


class RegraInfracaoRead(SQLModel):
    id: int
    escola_id: int
    descricao: str
    peso: int
    ativo: bool


class RegraInfracaoUpdate(SQLModel):
    descricao: Optional[str] = None
    peso: Optional[int] = None
    ativo: Optional[bool] = None
