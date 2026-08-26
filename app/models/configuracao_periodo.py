from datetime import date
from typing import Optional

from sqlalchemy import CheckConstraint
from sqlmodel import Field, SQLModel


class ConfiguracaoPeriodo(SQLModel, table=True):
    __tablename__ = "configuracao_periodo"
    __table_args__ = (
        CheckConstraint(
            "(trimestre1_inicio IS NULL OR trimestre1_fim IS NULL OR trimestre1_inicio <= trimestre1_fim) AND "
            "(trimestre2_inicio IS NULL OR trimestre2_fim IS NULL OR trimestre2_inicio <= trimestre2_fim) AND "
            "(trimestre3_inicio IS NULL OR trimestre3_fim IS NULL OR trimestre3_inicio <= trimestre3_fim)",
            name="ck_configuracao_periodo_ordem",
        ),
    )

    escola_id: int = Field(foreign_key="escola.id", primary_key=True)
    trimestre1_inicio: Optional[date] = Field(default=None)
    trimestre1_fim: Optional[date] = Field(default=None)
    trimestre2_inicio: Optional[date] = Field(default=None)
    trimestre2_fim: Optional[date] = Field(default=None)
    trimestre3_inicio: Optional[date] = Field(default=None)
    trimestre3_fim: Optional[date] = Field(default=None)
