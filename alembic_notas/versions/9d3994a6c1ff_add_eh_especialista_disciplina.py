"""add eh_especialista disciplina

Revision ID: 9d3994a6c1ff
Revises: d7a2c4b8f1e6
Create Date: 2026-09-03 00:30:33.929991

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9d3994a6c1ff'
down_revision: Union[str, None] = 'd7a2c4b8f1e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "disciplina",
        sa.Column("eh_especialista", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("disciplina", "eh_especialista")
