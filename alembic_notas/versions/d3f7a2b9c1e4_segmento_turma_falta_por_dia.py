"""adicionar segmento em turma e tornar disciplina_id opcional em registro_falta

Revision ID: d3f7a2b9c1e4
Revises: c4d18a5f9e3b
Create Date: 2026-08-25 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3f7a2b9c1e4'
down_revision: Union[str, None] = 'c4d18a5f9e3b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "turma",
        sa.Column("segmento", sa.String(), nullable=False, server_default="fundamental_2"),
    )
    op.alter_column("registro_falta", "disciplina_id", nullable=True)


def downgrade() -> None:
    # Falha se já existirem RegistroFalta gravados com disciplina_id NULL
    # (turmas Fundamental 1) — nesse caso é preciso corrigir manualmente antes
    # do downgrade, mesma classe de limitação de trocar o segmento de uma
    # turma no meio do ano.
    op.alter_column("registro_falta", "disciplina_id", nullable=False)
    op.drop_column("turma", "segmento")
