from typing import Optional

from sqlmodel import SQLModel


class PunicaoCreate(SQLModel):
    descricao: str
    pontuacao_minima: int


class PunicaoRead(SQLModel):
    id: int
    escola_id: int
    descricao: str
    pontuacao_minima: int
    ativo: bool


class PunicaoUpdate(SQLModel):
    descricao: Optional[str] = None
    pontuacao_minima: Optional[int] = None
    ativo: Optional[bool] = None
