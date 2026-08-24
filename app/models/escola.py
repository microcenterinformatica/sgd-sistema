from typing import Optional

from sqlmodel import Field, SQLModel


class Escola(SQLModel, table=True):
    __tablename__ = "escola"

    id: Optional[int] = Field(default=None, primary_key=True)
    nome: str
    cnpj: Optional[str] = None
    ativo: bool = Field(default=True)
