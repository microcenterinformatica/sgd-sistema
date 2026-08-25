"""criar turma e popular com turmas existentes dos alunos

Revision ID: 7b3e91f4c6a2
Revises: 49afb600d17c
Create Date: 2026-08-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7b3e91f4c6a2'
down_revision: Union[str, None] = '49afb600d17c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "turma",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("escola_id", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("escola_id", "nome", name="uq_turma_escola_nome"),
    )
    op.create_index("ix_turma_escola_id", "turma", ["escola_id"])

    op.execute(
        sa.text(
            """
            INSERT INTO turma (escola_id, nome, ativo)
            SELECT DISTINCT escola_id, turma, true FROM aluno
            WHERE turma IS NOT NULL AND turma <> ''
            UNION
            SELECT DISTINCT escola_id, turma, true FROM atribuicao_professor
            WHERE turma IS NOT NULL AND turma <> ''
            UNION
            SELECT DISTINCT escola_id, turma, true FROM atividade_nota
            WHERE turma IS NOT NULL AND turma <> ''
            ON CONFLICT (escola_id, nome) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.drop_table("turma")
