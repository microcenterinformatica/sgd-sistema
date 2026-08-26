"""chave composta (escola_id, id) em aluno e professor, base para FKs compostas
entre escolas na cadeia de notas (isolamento entre tenants)

Revision ID: c3f9a1b5e8d4
Revises: f4a8b3c7e2d5
Create Date: 2026-08-26 09:10:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c3f9a1b5e8d4'
down_revision: Union[str, None] = 'f4a8b3c7e2d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint("uq_aluno_escola_id", "aluno", ["escola_id", "id"])
    op.create_unique_constraint("uq_professor_escola_id", "professor", ["escola_id", "id"])


def downgrade() -> None:
    op.drop_constraint("uq_professor_escola_id", "professor", type_="unique")
    op.drop_constraint("uq_aluno_escola_id", "aluno", type_="unique")
