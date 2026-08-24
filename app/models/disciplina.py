from typing import Optional

from sqlmodel import Field, SQLModel


class Disciplina(SQLModel, table=True):
    __tablename__ = "disciplina"

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(index=True)
    nome: str
    ativo: bool = Field(default=True)
