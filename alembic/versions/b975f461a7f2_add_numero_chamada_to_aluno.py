"""add numero_chamada to aluno

Número do aluno na chamada/diário de classe. Pode se repetir entre turmas
diferentes (não é único globalmente nem por escola), por isso não leva
constraint de unicidade.

Revision ID: b975f461a7f2
Revises: 3e6f9b651d35
Create Date: 2026-07-11 10:48:24.201379

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b975f461a7f2'
down_revision: Union[str, None] = '3e6f9b651d35'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("aluno", sa.Column("numero_chamada", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("aluno", "numero_chamada")
