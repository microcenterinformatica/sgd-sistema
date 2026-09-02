"""adicionar valor_veracom_base em configuracao_ranking

Revision ID: d8f31a2b9c47
Revises: a7d2e9f1c4b8
Create Date: 2026-09-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8f31a2b9c47'
down_revision: Union[str, None] = 'a7d2e9f1c4b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "configuracao_ranking",
        sa.Column("valor_veracom_base", sa.Float(), nullable=False, server_default="0.2"),
    )


def downgrade() -> None:
    op.drop_column("configuracao_ranking", "valor_veracom_base")
