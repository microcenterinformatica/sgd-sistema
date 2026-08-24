from datetime import date
from typing import Optional

from sqlmodel import SQLModel


class ConfiguracaoPeriodoUpdate(SQLModel):
    trimestre1_inicio: Optional[date] = None
    trimestre1_fim: Optional[date] = None
    trimestre2_inicio: Optional[date] = None
    trimestre2_fim: Optional[date] = None
    trimestre3_inicio: Optional[date] = None
    trimestre3_fim: Optional[date] = None


class ConfiguracaoPeriodoRead(SQLModel):
    trimestre1_inicio: Optional[date]
    trimestre1_fim: Optional[date]
    trimestre2_inicio: Optional[date]
    trimestre2_fim: Optional[date]
    trimestre3_inicio: Optional[date]
    trimestre3_fim: Optional[date]
