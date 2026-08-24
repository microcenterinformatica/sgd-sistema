from datetime import date
from typing import Optional

from sqlmodel import SQLModel

from app.models.atividade import TipoAtividade


class LancamentoItem(SQLModel):
    aluno_id: int
    nota: Optional[float] = None
    fez: Optional[bool] = None
    entregue_em: Optional[date] = None
    observacao: Optional[str] = None


class LancamentoLoteCreate(SQLModel):
    itens: list[LancamentoItem]


class LancamentoRead(SQLModel):
    id: int
    atividade_id: int
    aluno_id: int
    nota: Optional[float]
    fez: Optional[bool]
    entregue_em: Optional[date]
    no_prazo: Optional[bool]
    observacao: Optional[str]
    aluno_nome: Optional[str] = None


class LancamentoAlunoRead(SQLModel):
    id: int
    atividade_id: int
    atividade_titulo: str
    atividade_tipo: TipoAtividade
    atividade_turma: Optional[str]
    disciplina_id: int
    disciplina_nome: str
    atividade_data: date
    atividade_data_entrega: Optional[date]
    nota: Optional[float]
    fez: Optional[bool]
    entregue_em: Optional[date]
    no_prazo: Optional[bool]
    observacao: Optional[str]
