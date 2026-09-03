from datetime import date
from typing import Optional

from pydantic import model_validator
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

    @model_validator(mode="after")
    def _validar_data_entrega(self):
        if self.data_entrega is not None and self.data_entrega < self.data:
            raise ValueError("Data de entrega não pode ser anterior à data da atividade")
        return self


class AtividadeNaoEntregueRead(SQLModel):
    aluno_id: int
    atividade_titulo: str
    disciplina_nome: str
    tipo: TipoAtividade
    data: date


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
    total_lancamentos: int = 0


class AtividadeResumoItem(SQLModel):
    aluno_id: int
    aluno_nome: str
    total_atividades: int
    total_fez: int
    percentual: float


class AlunoPendenteRead(SQLModel):
    aluno_id: int
    aluno_nome: str


class AtividadePendenciaRead(SQLModel):
    atividade_id: int
    atividade_titulo: str
    tipo: TipoAtividade
    data: date
    data_entrega: Optional[date]
    alunos_pendentes: list[AlunoPendenteRead]
