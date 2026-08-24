from datetime import date
from typing import Optional

from sqlmodel import SQLModel

from app.models.atividade import TipoAtividade


class AtividadeCreate(SQLModel):
    titulo: str
    tipo: TipoAtividade
    disciplina_id: int
    turma: str
    professor_id: Optional[int] = None
    categoria_id: int
    data: date
    data_entrega: Optional[date] = None


class AtividadeUpdate(SQLModel):
    titulo: Optional[str] = None
    categoria_id: Optional[int] = None
    data: Optional[date] = None
    data_entrega: Optional[date] = None


class AtividadeRead(SQLModel):
    id: int
    escola_id: int
    professor_id: Optional[int]
    disciplina_id: int
    turma: Optional[str]
    titulo: str
    tipo: TipoAtividade
    categoria_id: int
    categoria_nome: str
    categoria_peso: float
    data: date
    data_entrega: Optional[date]
    ativo: bool


class AtividadeResumoItem(SQLModel):
    aluno_id: int
    aluno_nome: str
    total_atividades: int
    total_fez: int
    percentual: float
