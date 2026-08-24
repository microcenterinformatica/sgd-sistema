from datetime import date
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class TipoAtividade(str, Enum):
    prova = "prova"
    atividade = "atividade"


class Atividade(SQLModel, table=True):
    __tablename__ = "atividade_nota"

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(index=True)
    professor_id: Optional[int] = Field(default=None)
    disciplina_id: int = Field(foreign_key="disciplina.id", index=True)
    turma: Optional[str] = Field(default=None, index=True)
    titulo: str
    tipo: TipoAtividade
    categoria_id: int = Field(foreign_key="categoria_atividade.id", index=True)
    data: date
    data_entrega: Optional[date] = Field(default=None)
    ativo: bool = Field(default=True)
