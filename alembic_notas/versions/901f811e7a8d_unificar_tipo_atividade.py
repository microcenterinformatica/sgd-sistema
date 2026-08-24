"""unificar tipos trabalho/tarefa em atividade

Revision ID: 901f811e7a8d
Revises: cb6c9cde2417
Create Date: 2026-07-08 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '901f811e7a8d'
down_revision: Union[str, None] = 'cb6c9cde2417'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text("UPDATE atividade_nota SET tipo = 'atividade' WHERE tipo IN ('trabalho', 'tarefa')")
    )


def downgrade() -> None:
    pass
