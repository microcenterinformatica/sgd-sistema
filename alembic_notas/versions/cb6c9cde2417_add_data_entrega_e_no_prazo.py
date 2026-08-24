"""add data_entrega em atividade_nota e entregue_em/no_prazo em lancamento_nota

Revision ID: cb6c9cde2417
Revises: a1b2c3d4e5f6
Create Date: 2026-07-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cb6c9cde2417'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("atividade_nota", sa.Column("data_entrega", sa.Date(), nullable=True))
    op.add_column("lancamento_nota", sa.Column("entregue_em", sa.Date(), nullable=True))
    op.add_column("lancamento_nota", sa.Column("no_prazo", sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column("lancamento_nota", "no_prazo")
    op.drop_column("lancamento_nota", "entregue_em")
    op.drop_column("atividade_nota", "data_entrega")
