from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, ForeignKeyConstraint, UniqueConstraint
from sqlmodel import Field, SQLModel


class AjusteNota(SQLModel, table=True):
    __tablename__ = "ajuste_nota"
    __table_args__ = (
        UniqueConstraint("aluno_id", "disciplina_id", "trimestre", name="uq_ajuste_nota_aluno_disciplina_trimestre"),
        CheckConstraint("nota_ajustada >= 0 AND nota_ajustada <= 10", name="ck_ajuste_nota_faixa"),
        CheckConstraint("trimestre BETWEEN 1 AND 3", name="ck_ajuste_nota_trimestre"),
        ForeignKeyConstraint(
            ["escola_id", "aluno_id"], ["aluno.escola_id", "aluno.id"],
            name="ajuste_nota_aluno_composta_fkey",
        ),
        ForeignKeyConstraint(
            ["escola_id", "disciplina_id"], ["disciplina.escola_id", "disciplina.id"],
            name="ajuste_nota_disciplina_composta_fkey",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(foreign_key="escola.id", index=True)
    aluno_id: int = Field(index=True)
    disciplina_id: int = Field(index=True)
    trimestre: int
    nota_ajustada: float
    motivo: str
    registrado_por_usuario_id: int = Field(foreign_key="usuario.id")
    criado_em: datetime = Field(default_factory=datetime.utcnow)
