from datetime import date
from typing import Optional

from sqlmodel import SQLModel


class AnoLetivoCreate(SQLModel):
    ano: int
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    situacao: str = "aberto"


class AnoLetivoUpdate(SQLModel):
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    situacao: Optional[str] = None


class AnoLetivoRead(SQLModel):
    id: int
    escola_id: int
    ano: int
    data_inicio: Optional[date]
    data_fim: Optional[date]
    situacao: str
