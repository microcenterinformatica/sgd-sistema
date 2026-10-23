"""categoria de conduta automatica

Revision ID: e5b8c2f7a9d3
Revises: 9d3994a6c1ff
Create Date: 2026-10-23 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5b8c2f7a9d3'
down_revision: Union[str, None] = '9d3994a6c1ff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "categoria_atividade",
        sa.Column("tipo", sa.String(), nullable=False, server_default="manual"),
    )
    op.add_column("categoria_atividade", sa.Column("desconto_por_ponto", sa.Float(), nullable=True))
    op.create_check_constraint(
        "ck_categoria_atividade_desconto_por_ponto",
        "categoria_atividade",
        "desconto_por_ponto IS NULL OR desconto_por_ponto > 0",
    )


def downgrade() -> None:
    op.drop_constraint("ck_categoria_atividade_desconto_por_ponto", "categoria_atividade", type_="check")
    op.drop_column("categoria_atividade", "desconto_por_ponto")
    op.drop_column("categoria_atividade", "tipo")
