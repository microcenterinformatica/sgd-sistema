from typing import Optional

from sqlmodel import Field, SQLModel


class Punicao(SQLModel, table=True):
    __tablename__ = "punicao"

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(foreign_key="escola.id", index=True)
    descricao: str
    pontuacao_minima: int
    ativo: bool = Field(default=True)
