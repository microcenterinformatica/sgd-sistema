"""criar ajuste_nota (correcao manual de nota final por trimestre)

Revision ID: c4d18a5f9e3b
Revises: 7b3e91f4c6a2
Create Date: 2026-08-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4d18a5f9e3b'
down_revision: Union[str, None] = '7b3e91f4c6a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ajuste_nota",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("escola_id", sa.Integer(), nullable=False),
        sa.Column("aluno_id", sa.Integer(), sa.ForeignKey("aluno.id"), nullable=False),
        sa.Column("disciplina_id", sa.Integer(), sa.ForeignKey("disciplina.id"), nullable=False),
        sa.Column("trimestre", sa.Integer(), nullable=False),
        sa.Column("nota_ajustada", sa.Float(), nullable=False),
        sa.Column("motivo", sa.String(), nullable=False),
        sa.Column("registrado_por_usuario_id", sa.Integer(), sa.ForeignKey("usuario.id"), nullable=False),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("aluno_id", "disciplina_id", "trimestre", name="uq_ajuste_nota_aluno_disciplina_trimestre"),
    )
    op.create_index("ix_ajuste_nota_escola_id", "ajuste_nota", ["escola_id"])
    op.create_index("ix_ajuste_nota_aluno_id", "ajuste_nota", ["aluno_id"])
    op.create_index("ix_ajuste_nota_disciplina_id", "ajuste_nota", ["disciplina_id"])


def downgrade() -> None:
    op.drop_table("ajuste_nota")
