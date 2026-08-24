"""criar conteudo_aula para diario de classe

Revision ID: 49afb600d17c
Revises: 8e73ed651f6f
Create Date: 2026-07-10 23:52:09.577654

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '49afb600d17c'
down_revision: Union[str, None] = '8e73ed651f6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "conteudo_aula",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("escola_id", sa.Integer(), nullable=False),
        sa.Column("professor_id", sa.Integer(), nullable=True),
        sa.Column("disciplina_id", sa.Integer(), sa.ForeignKey("disciplina.id"), nullable=False),
        sa.Column("turma", sa.String(), nullable=False),
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column("conteudo", sa.String(), nullable=False),
        sa.Column("registrado_por_usuario_id", sa.Integer(), nullable=False),
    )
    op.create_index("ix_conteudo_aula_escola_id", "conteudo_aula", ["escola_id"])
    op.create_index("ix_conteudo_aula_professor_id", "conteudo_aula", ["professor_id"])
    op.create_index("ix_conteudo_aula_disciplina_id", "conteudo_aula", ["disciplina_id"])
    op.create_index("ix_conteudo_aula_turma", "conteudo_aula", ["turma"])
    op.create_index("ix_conteudo_aula_data", "conteudo_aula", ["data"])
    op.create_unique_constraint(
        "uq_conteudo_aula_disciplina_turma_data",
        "conteudo_aula",
        ["escola_id", "disciplina_id", "turma", "data"],
    )


def downgrade() -> None:
    op.drop_table("conteudo_aula")
