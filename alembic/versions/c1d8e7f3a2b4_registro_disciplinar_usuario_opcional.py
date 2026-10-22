"""tornar registrado_por_usuario_id opcional em registro_disciplinar

Revision ID: c1d8e7f3a2b4
Revises: b6e2f4a8c1d3
Create Date: 2026-10-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d8e7f3a2b4'
down_revision: Union[str, None] = 'b6e2f4a8c1d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Registros gerados automaticamente (recuperação automática de pontos)
    # não têm um usuário humano por trás da ação.
    op.alter_column(
        "registro_disciplinar",
        "registrado_por_usuario_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "registro_disciplinar",
        "registrado_por_usuario_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
