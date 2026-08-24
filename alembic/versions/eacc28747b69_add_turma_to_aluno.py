"""add turma to aluno

Revision ID: eacc28747b69
Revises: 4cf5e1b4da42
Create Date: 2026-07-01 10:31:01.144819

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'eacc28747b69'
down_revision: Union[str, None] = '4cf5e1b4da42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("aluno", sa.Column("turma", sa.String(), nullable=True))
    op.create_index("ix_aluno_turma", "aluno", ["turma"])


def downgrade() -> None:
    op.drop_index("ix_aluno_turma", table_name="aluno")
    op.drop_column("aluno", "turma")
