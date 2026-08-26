from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlmodel import Field, SQLModel


class AjusteNota(SQLModel, table=True):
    __tablename__ = "ajuste_nota"
    __table_args__ = (
        UniqueConstraint("aluno_id", "disciplina_id", "trimestre", name="uq_ajuste_nota_aluno_disciplina_trimestre"),
        CheckConstraint("nota_ajustada >= 0 AND nota_ajustada <= 10", name="ck_ajuste_nota_faixa"),
        CheckConstraint("trimestre BETWEEN 1 AND 3", name="ck_ajuste_nota_trimestre"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(foreign_key="escola.id", index=True)
    aluno_id: int = Field(foreign_key="aluno.id", index=True)
    disciplina_id: int = Field(foreign_key="disciplina.id", index=True)
    trimestre: int
    nota_ajustada: float
    motivo: str
    registrado_por_usuario_id: int = Field(foreign_key="usuario.id")
    criado_em: datetime = Field(default_factory=datetime.utcnow)
