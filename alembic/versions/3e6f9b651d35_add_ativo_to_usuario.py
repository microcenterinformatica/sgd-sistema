"""add ativo to usuario

Revision ID: 3e6f9b651d35
Revises: fc0acfa1bd0d
Create Date: 2026-07-01 21:55:32.320346

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3e6f9b651d35'
down_revision: Union[str, None] = 'fc0acfa1bd0d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("usuario", sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    op.drop_column("usuario", "ativo")
