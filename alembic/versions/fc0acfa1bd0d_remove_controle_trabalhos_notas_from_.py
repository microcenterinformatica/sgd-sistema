"""remove controle_trabalhos_notas from aluno

Revision ID: fc0acfa1bd0d
Revises: eacc28747b69
Create Date: 2026-07-01 12:21:32.441664

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fc0acfa1bd0d'
down_revision: Union[str, None] = 'eacc28747b69'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("aluno", "controle_trabalhos_notas")


def downgrade() -> None:
    op.add_column("aluno", sa.Column("controle_trabalhos_notas", sa.String(), nullable=True))
