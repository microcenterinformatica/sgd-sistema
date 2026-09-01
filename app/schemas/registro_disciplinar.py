from datetime import datetime, timezone
from typing import Optional

from pydantic import field_serializer
from sqlmodel import SQLModel

from app.models.registro_disciplinar import TipoRegistro


class RegistroInfracaoCreate(SQLModel):
    aluno_id: int
    regra_id: int
    professor_id: Optional[int] = None
    observacao: Optional[str] = None


class RegistroMeritoCreate(SQLModel):
    aluno_id: int
    pontos_bonus: int
    professor_id: Optional[int] = None
    observacao: Optional[str] = None


class RegistroMeritoTurmaCreate(SQLModel):
    turma: str
    pontos_bonus: int
    professor_id: Optional[int] = None
    observacao: Optional[str] = None


class RegistroMeritoTurmaResponse(SQLModel):
    turma: str
    total_alunos: int


class RegistroInfracaoUpdate(SQLModel):
    regra_id: int
    professor_id: Optional[int] = None
    observacao: Optional[str] = None


class RegistroDisciplinarRead(SQLModel):
    id: int
    aluno_id: int
    tipo: TipoRegistro
    regra_id: Optional[int]
    descricao: str
    peso: int
    data_hora: datetime
    observacao: Optional[str]
    professor_id: Optional[int]
    registrado_por_usuario_id: int
    professor_nome: Optional[str] = None

    @field_serializer("data_hora")
    def _serializar_data_hora(self, valor: datetime) -> str:
        # data_hora é armazenado em UTC sem tzinfo; marcamos o offset explicitamente
        # na resposta para que o navegador converta corretamente para o horário local
        # (sem isso, o front-end interpreta a string como se já fosse hora local).
        if valor.tzinfo is None:
            valor = valor.replace(tzinfo=timezone.utc)
        return valor.isoformat()


class RegistroDisciplinarResponse(SQLModel):
    registro: RegistroDisciplinarRead
    pontos_atuais: int
    whatsapp_link: Optional[str] = None
