from datetime import date
from enum import Enum
from typing import Optional

from sqlalchemy import CheckConstraint
from sqlmodel import Field, SQLModel


class TipoAtividade(str, Enum):
    prova = "prova"
    atividade = "atividade"


class Atividade(SQLModel, table=True):
    __tablename__ = "atividade_nota"
    __table_args__ = (
        CheckConstraint(
            "data_entrega IS NULL OR data_entrega >= data", name="ck_atividade_nota_data_entrega"
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(foreign_key="escola.id", index=True)
    professor_id: Optional[int] = Field(default=None, foreign_key="professor.id")
    disciplina_id: int = Field(foreign_key="disciplina.id", index=True)
    turma: Optional[str] = Field(default=None, index=True)
    titulo: str
    tipo: TipoAtividade
    categoria_id: int = Field(foreign_key="categoria_atividade.id", index=True)
    data: date
    data_entrega: Optional[date] = Field(default=None)
    ativo: bool = Field(default=True)
