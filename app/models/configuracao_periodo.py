from datetime import date
from typing import Optional

from sqlmodel import Field, SQLModel


class ConfiguracaoPeriodo(SQLModel, table=True):
    __tablename__ = "configuracao_periodo"

    escola_id: int = Field(primary_key=True)
    trimestre1_inicio: Optional[date] = Field(default=None)
    trimestre1_fim: Optional[date] = Field(default=None)
    trimestre2_inicio: Optional[date] = Field(default=None)
    trimestre2_fim: Optional[date] = Field(default=None)
    trimestre3_inicio: Optional[date] = Field(default=None)
    trimestre3_fim: Optional[date] = Field(default=None)
