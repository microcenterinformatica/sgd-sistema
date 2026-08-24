from datetime import date
from typing import Optional

from sqlmodel import SQLModel


class BoletimGrupoPeso(SQLModel):
    categoria: str
    peso: float
    quantidade_atividades: int
    media: float
    pontos: float


class BoletimAluno(SQLModel):
    aluno_id: int
    aluno_nome: str
    grupos: list[BoletimGrupoPeso]
    peso_total: float
    nota_final: float
    total_faltas: int
    faltas_justificadas: int


class BoletimTrimestre(SQLModel):
    trimestre: int
    data_inicio: Optional[date]
    data_fim: Optional[date]
    grupos: list[BoletimGrupoPeso]
    peso_total: float
    nota_final: float
    total_faltas: int
    faltas_justificadas: int


class BoletimDisciplinaAnual(SQLModel):
    disciplina_id: int
    disciplina_nome: str
    trimestres: list[BoletimTrimestre]
    media_final: float
    aprovado: bool
    total_faltas: int


class BoletimAnualAluno(SQLModel):
    aluno_id: int
    aluno_nome: str
    disciplinas: list[BoletimDisciplinaAnual]
