from typing import Optional

from sqlmodel import Field, SQLModel


class RegraInfracao(SQLModel, table=True):
    __tablename__ = "regra_infracao"

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(foreign_key="escola.id", index=True)
    descricao: str
    peso: int
    ativo: bool = Field(default=True)
