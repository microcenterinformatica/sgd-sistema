"""adicionar peso_nao_entrega em configuracao_ranking

Revision ID: f3a8c1d4e7b2
Revises: c3f9a1b5e8d4
Create Date: 2026-08-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a8c1d4e7b2'
down_revision: Union[str, None] = 'c3f9a1b5e8d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "configuracao_ranking",
        sa.Column("peso_nao_entrega", sa.Float(), nullable=False, server_default="0.0"),
    )


def downgrade() -> None:
    op.drop_column("configuracao_ranking", "peso_nao_entrega")
