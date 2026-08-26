from typing import Optional

from sqlalchemy import CheckConstraint
from sqlmodel import Field, SQLModel


class Punicao(SQLModel, table=True):
    __tablename__ = "punicao"
    __table_args__ = (CheckConstraint("pontuacao_minima >= 0", name="ck_punicao_pontuacao_minima"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(foreign_key="escola.id", index=True)
    descricao: str
    pontuacao_minima: int = Field(ge=0)
    ativo: bool = Field(default=True)
