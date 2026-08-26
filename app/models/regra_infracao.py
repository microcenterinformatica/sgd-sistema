from typing import Optional

from sqlalchemy import CheckConstraint
from sqlmodel import Field, SQLModel


class RegraInfracao(SQLModel, table=True):
    __tablename__ = "regra_infracao"
    __table_args__ = (CheckConstraint("peso >= 0", name="ck_regra_infracao_peso"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(foreign_key="escola.id", index=True)
    descricao: str
    peso: int = Field(ge=0)
    ativo: bool = Field(default=True)
