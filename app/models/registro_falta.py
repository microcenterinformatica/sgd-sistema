from datetime import date
from typing import Optional

from sqlalchemy import Index, text
from sqlmodel import Field, SQLModel


class RegistroFalta(SQLModel, table=True):
    __tablename__ = "registro_falta"
    __table_args__ = (
        Index(
            "uq_registro_falta_aluno_data_disciplina",
            "aluno_id", "data", text("COALESCE(disciplina_id, -1)"),
            unique=True,
        ),
        Index("ix_registro_falta_aluno_data", "aluno_id", "data"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    aluno_id: int = Field(foreign_key="aluno.id", index=True)
    escola_id: int = Field(foreign_key="escola.id", index=True)
    disciplina_id: Optional[int] = Field(default=None, foreign_key="disciplina.id", index=True)
    data: date
    justificada: bool = Field(default=False)
    observacao: Optional[str] = Field(default=None)
    registrado_por_usuario_id: int = Field(foreign_key="usuario.id")
