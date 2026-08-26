from datetime import date
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class AnoLetivo(SQLModel, table=True):
    __tablename__ = "ano_letivo"
    __table_args__ = (UniqueConstraint("escola_id", "ano", name="uq_ano_letivo_escola_ano"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(foreign_key="escola.id", index=True)
    ano: int
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    situacao: str = Field(default="aberto")
