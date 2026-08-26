from datetime import date
from typing import Optional

from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlmodel import Field, SQLModel


class Lancamento(SQLModel, table=True):
    __tablename__ = "lancamento_nota"
    __table_args__ = (
        UniqueConstraint("atividade_id", "aluno_id", name="uq_lancamento_nota_atividade_aluno"),
        CheckConstraint("nota IS NULL OR (nota >= 0 AND nota <= 10)", name="ck_lancamento_nota_faixa"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    atividade_id: int = Field(foreign_key="atividade_nota.id", index=True)
    aluno_id: int = Field(foreign_key="aluno.id", index=True)
    nota: Optional[float] = Field(default=None)
    fez: Optional[bool] = Field(default=None)
    entregue_em: Optional[date] = Field(default=None)
    no_prazo: Optional[bool] = Field(default=None)
    observacao: Optional[str] = Field(default=None)
