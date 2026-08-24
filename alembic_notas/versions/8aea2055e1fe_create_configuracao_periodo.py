"""create configuracao_periodo

Revision ID: 8aea2055e1fe
Revises: 901f811e7a8d
Create Date: 2026-07-08 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8aea2055e1fe'
down_revision: Union[str, None] = '901f811e7a8d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "configuracao_periodo",
        sa.Column("escola_id", sa.Integer(), primary_key=True),
        sa.Column("trimestre1_inicio", sa.Date(), nullable=True),
        sa.Column("trimestre1_fim", sa.Date(), nullable=True),
        sa.Column("trimestre2_inicio", sa.Date(), nullable=True),
        sa.Column("trimestre2_fim", sa.Date(), nullable=True),
        sa.Column("trimestre3_inicio", sa.Date(), nullable=True),
        sa.Column("trimestre3_fim", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("configuracao_periodo")
