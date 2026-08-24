from datetime import date
from typing import Optional

from sqlmodel import Field, SQLModel


class Lancamento(SQLModel, table=True):
    __tablename__ = "lancamento_nota"

    id: Optional[int] = Field(default=None, primary_key=True)
    atividade_id: int = Field(foreign_key="atividade_nota.id", index=True)
    aluno_id: int = Field(index=True)
    nota: Optional[float] = Field(default=None)
    fez: Optional[bool] = Field(default=None)
    entregue_em: Optional[date] = Field(default=None)
    no_prazo: Optional[bool] = Field(default=None)
    observacao: Optional[str] = Field(default=None)
