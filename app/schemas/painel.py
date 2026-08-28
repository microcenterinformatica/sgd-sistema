from typing import Literal, Optional

from sqlmodel import SQLModel

from app.schemas.registro_disciplinar import RegistroDisciplinarRead


class AlunoAlerta(SQLModel):
    aluno_id: int
    aluno_nome: str
    turma: Optional[str]
    pontos_atuais: int
    punicao_atual: Optional[str] = None
    proxima_punicao: Optional[str] = None
    pontos_faltantes: Optional[int] = None


class RegistroRecente(RegistroDisciplinarRead):
    aluno_nome: str


class AlunoFaltouHoje(SQLModel):
    aluno_id: int
    aluno_nome: str
    turma: Optional[str]
    disciplinas: list[str] = []
    whatsapp_link: Optional[str] = None


class PainelResumo(SQLModel):
    escopo: Literal["total", "turmas"]
    turmas: list[str]
    total_alunos: int
    ocorrencias_mes: int
    pontos_merito_mes: int
    alunos_alerta: list[AlunoAlerta]
    recentes: list[RegistroRecente]
    faltas_hoje: list[AlunoFaltouHoje]
