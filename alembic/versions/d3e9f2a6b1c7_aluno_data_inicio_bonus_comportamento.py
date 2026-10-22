"""adicionar data_inicio_bonus_comportamento em aluno

Revision ID: d3e9f2a6b1c7
Revises: c1d8e7f3a2b4
Create Date: 2026-10-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3e9f2a6b1c7'
down_revision: Union[str, None] = 'c1d8e7f3a2b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "aluno",
        sa.Column("data_inicio_bonus_comportamento", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("aluno", "data_inicio_bonus_comportamento")
