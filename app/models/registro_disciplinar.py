from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class TipoRegistro(str, Enum):
    infracao = "infracao"
    merito = "merito"


class RegistroDisciplinar(SQLModel, table=True):
    __tablename__ = "registro_disciplinar"

    id: Optional[int] = Field(default=None, primary_key=True)
    aluno_id: int = Field(foreign_key="aluno.id", index=True)
    tipo: TipoRegistro
    regra_id: Optional[int] = Field(default=None, foreign_key="regra_infracao.id")
    descricao: str
    peso: int
    data_hora: datetime = Field(default_factory=datetime.utcnow)
    observacao: Optional[str] = None
    professor_id: Optional[int] = Field(default=None, foreign_key="professor.id")
    # Nulo para registros gerados automaticamente pelo sistema (ex: recuperação
    # automática de pontos), que não têm nenhum usuário humano por trás da ação.
    registrado_por_usuario_id: Optional[int] = Field(default=None, foreign_key="usuario.id")
