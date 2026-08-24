"""adicionar categoria em atividade_nota

Coluna nova para agrupar atividades no boletim de forma independente do peso
(ex: "Tarefa de casa" e "Atividade em sala" podem ter o mesmo peso mas devem
contar separado). Atividades existentes recebem categoria = peso para manter
o cálculo do boletim exatamente igual ao de antes.

Revision ID: 25f971e5882f
Revises: e73a380461b9
Create Date: 2026-07-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '25f971e5882f'
down_revision: Union[str, None] = 'e73a380461b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("atividade_nota", sa.Column("categoria", sa.String(), nullable=True))
    op.execute(sa.text("UPDATE atividade_nota SET categoria = peso::text WHERE categoria IS NULL"))
    op.alter_column("atividade_nota", "categoria", nullable=False)


def downgrade() -> None:
    op.drop_column("atividade_nota", "categoria")
