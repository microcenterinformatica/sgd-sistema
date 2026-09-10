"""adicionar nome_moeda em configuracao_ranking

Revision ID: b6e2f4a8c1d3
Revises: d8f31a2b9c47
Create Date: 2026-09-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b6e2f4a8c1d3'
down_revision: Union[str, None] = 'd8f31a2b9c47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "configuracao_ranking",
        sa.Column("nome_moeda", sa.String(), nullable=False, server_default="Veracom"),
    )


def downgrade() -> None:
    op.drop_column("configuracao_ranking", "nome_moeda")
