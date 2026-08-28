"""adicionar ativo em configuracao_recuperacao

Revision ID: a7d2e9f1c4b8
Revises: f3a8c1d4e7b2
Create Date: 2026-08-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7d2e9f1c4b8'
down_revision: Union[str, None] = 'f3a8c1d4e7b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "configuracao_recuperacao",
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("configuracao_recuperacao", "ativo")
