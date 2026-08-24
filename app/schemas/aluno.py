from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel


class AlunoCreate(SQLModel):
    nome: str
    matricula: str
    turma: Optional[str] = None
    numero_chamada: Optional[int] = None
    whatsapp_responsavel: Optional[str] = None
    observacoes_condutas: Optional[str] = None


class AlunoRead(SQLModel):
    id: int
    escola_id: int
    nome: str
    matricula: str
    turma: Optional[str]
    numero_chamada: Optional[int]
    whatsapp_responsavel: Optional[str]
    observacoes_condutas: Optional[str]
    pontos_atuais: int
    data_ultima_infracao: Optional[datetime]
    data_ultima_recuperacao: Optional[datetime]


class AlunoUpdate(SQLModel):
    nome: Optional[str] = None
    matricula: Optional[str] = None
    turma: Optional[str] = None
    numero_chamada: Optional[int] = None
    whatsapp_responsavel: Optional[str] = None
    observacoes_condutas: Optional[str] = None
