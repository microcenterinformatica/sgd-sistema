"""criar configuracao_ranking (peso da falta no ranking de merito)

Revision ID: e2c7a4f9d1b6
Revises: b975f461a7f2
Create Date: 2026-08-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2c7a4f9d1b6'
down_revision: Union[str, None] = 'b975f461a7f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "configuracao_ranking",
        sa.Column("escola_id", sa.Integer(), sa.ForeignKey("escola.id"), primary_key=True),
        sa.Column("peso_falta", sa.Float(), nullable=False, server_default="1.0"),
    )


def downgrade() -> None:
    op.drop_table("configuracao_ranking")
