from datetime import date
from typing import Optional

from sqlmodel import SQLModel


class FaltaRead(SQLModel):
    id: int
    aluno_id: int
    disciplina_id: int
    data: date
    justificada: bool
    observacao: Optional[str]


class FaltaResumoItem(SQLModel):
    aluno_id: int
    aluno_nome: str
    total_faltas: int


class ChamadaItemFalta(SQLModel):
    aluno_id: int
    justificada: bool = False
    observacao: Optional[str] = None


class ChamadaSalvar(SQLModel):
    turma: str
    disciplina_id: int
    data: date
    conteudo: Optional[str] = None
    faltas: list[ChamadaItemFalta] = []


class ChamadaAlunoStatus(SQLModel):
    aluno_id: int
    aluno_nome: str
    matricula: str
    numero_chamada: Optional[int]
    ausente: bool
    justificada: bool
    observacao: Optional[str]


class ChamadaRead(SQLModel):
    turma: str
    disciplina_id: int
    data: date
    conteudo: Optional[str]
    alunos: list[ChamadaAlunoStatus]


class ConteudoAulaRead(SQLModel):
    id: int
    turma: str
    disciplina_id: int
    data: date
    conteudo: str
