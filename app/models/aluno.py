from datetime import datetime
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class Aluno(SQLModel, table=True):
    __tablename__ = "aluno"
    __table_args__ = (UniqueConstraint("escola_id", "matricula", name="uq_aluno_escola_matricula"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(foreign_key="escola.id", index=True)
    nome: str
    matricula: str
    turma: Optional[str] = Field(default=None, index=True)
    numero_chamada: Optional[int] = Field(default=None)
    whatsapp_responsavel: Optional[str] = None
    observacoes_condutas: Optional[str] = None
    pontos_atuais: int = Field(default=0)
    data_ultima_infracao: Optional[datetime] = None
    data_ultima_recuperacao: Optional[datetime] = None
