"""create atividade_nota, lancamento_nota e registro_falta

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-07-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "atividade_nota",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("escola_id", sa.Integer(), nullable=False),
        sa.Column("professor_id", sa.Integer(), nullable=True),
        sa.Column("turma", sa.String(), nullable=True),
        sa.Column("titulo", sa.String(), nullable=False),
        sa.Column("tipo", sa.String(), nullable=False),
        sa.Column("peso", sa.Float(), nullable=False),
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_atividade_nota_escola_id", "atividade_nota", ["escola_id"])
    op.create_index("ix_atividade_nota_turma", "atividade_nota", ["turma"])

    op.create_table(
        "lancamento_nota",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("atividade_id", sa.Integer(), sa.ForeignKey("atividade_nota.id"), nullable=False),
        sa.Column("aluno_id", sa.Integer(), nullable=False),
        sa.Column("nota", sa.Float(), nullable=True),
        sa.Column("fez", sa.Boolean(), nullable=True),
        sa.Column("observacao", sa.String(), nullable=True),
    )
    op.create_index("ix_lancamento_nota_atividade_id", "lancamento_nota", ["atividade_id"])
    op.create_index("ix_lancamento_nota_aluno_id", "lancamento_nota", ["aluno_id"])

    op.create_table(
        "registro_falta",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("aluno_id", sa.Integer(), nullable=False),
        sa.Column("escola_id", sa.Integer(), nullable=False),
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column("justificada", sa.Boolean(), nullable=False),
        sa.Column("observacao", sa.String(), nullable=True),
        sa.Column("registrado_por_usuario_id", sa.Integer(), nullable=False),
    )
    op.create_index("ix_registro_falta_aluno_id", "registro_falta", ["aluno_id"])
    op.create_index("ix_registro_falta_escola_id", "registro_falta", ["escola_id"])


def downgrade() -> None:
    op.drop_table("registro_falta")
    op.drop_table("lancamento_nota")
    op.drop_table("atividade_nota")
