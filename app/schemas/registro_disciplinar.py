from datetime import datetime
from typing import Optional

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


class RegistroDisciplinarResponse(SQLModel):
    registro: RegistroDisciplinarRead
    pontos_atuais: int
    whatsapp_link: Optional[str] = None
