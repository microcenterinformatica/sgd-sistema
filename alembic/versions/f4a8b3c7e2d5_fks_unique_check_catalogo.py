"""adiciona checks/unique que faltavam em regra_infracao, punicao, professor, usuario

Revision ID: f4a8b3c7e2d5
Revises: e2c7a4f9d1b6
Create Date: 2026-08-26 08:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4a8b3c7e2d5'
down_revision: Union[str, None] = 'e2c7a4f9d1b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_check_constraint("ck_regra_infracao_peso", "regra_infracao", "peso >= 0")
    op.create_check_constraint("ck_punicao_pontuacao_minima", "punicao", "pontuacao_minima >= 0")
    op.create_unique_constraint("uq_professor_usuario_id", "professor", ["usuario_id"])

    # ix_usuario_email era um indice unico case-sensitive; troca por um funcional
    # (lower(email)) para pegar duplicatas tipo "Admin@escola.com" x "admin@escola.com".
    op.drop_index("ix_usuario_email", table_name="usuario")
    op.create_index("uq_usuario_email_lower", "usuario", [sa.text("lower(email)")], unique=True)


def downgrade() -> None:
    op.drop_index("uq_usuario_email_lower", table_name="usuario")
    op.create_index("ix_usuario_email", "usuario", ["email"], unique=True)

    op.drop_constraint("uq_professor_usuario_id", "professor", type_="unique")
    op.drop_constraint("ck_punicao_pontuacao_minima", "punicao", type_="check")
    op.drop_constraint("ck_regra_infracao_peso", "regra_infracao", type_="check")
