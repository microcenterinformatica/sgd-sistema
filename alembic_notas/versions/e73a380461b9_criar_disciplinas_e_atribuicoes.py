"""criar disciplina e atribuicao_professor, adicionar disciplina_id

Apaga os dados de teste existentes em lancamento_nota, atividade_nota e
registro_falta antes de tornar disciplina_id obrigatorio nessas tabelas.

Revision ID: e73a380461b9
Revises: 8aea2055e1fe
Create Date: 2026-07-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e73a380461b9'
down_revision: Union[str, None] = '8aea2055e1fe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "disciplina",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("escola_id", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_disciplina_escola_id", "disciplina", ["escola_id"])

    op.create_table(
        "atribuicao_professor",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("escola_id", sa.Integer(), nullable=False),
        sa.Column("professor_id", sa.Integer(), nullable=False),
        sa.Column("disciplina_id", sa.Integer(), sa.ForeignKey("disciplina.id"), nullable=False),
        sa.Column("turma", sa.String(), nullable=False),
    )
    op.create_index("ix_atribuicao_professor_escola_id", "atribuicao_professor", ["escola_id"])
    op.create_index("ix_atribuicao_professor_professor_id", "atribuicao_professor", ["professor_id"])
    op.create_index("ix_atribuicao_professor_disciplina_id", "atribuicao_professor", ["disciplina_id"])
    op.create_index("ix_atribuicao_professor_turma", "atribuicao_professor", ["turma"])

    op.execute(sa.text("DELETE FROM lancamento_nota"))
    op.execute(sa.text("DELETE FROM atividade_nota"))
    op.execute(sa.text("DELETE FROM registro_falta"))

    op.add_column("atividade_nota", sa.Column("disciplina_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_atividade_nota_disciplina_id", "atividade_nota", "disciplina", ["disciplina_id"], ["id"]
    )
    op.alter_column("atividade_nota", "disciplina_id", nullable=False)
    op.create_index("ix_atividade_nota_disciplina_id", "atividade_nota", ["disciplina_id"])

    op.add_column("registro_falta", sa.Column("disciplina_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_registro_falta_disciplina_id", "registro_falta", "disciplina", ["disciplina_id"], ["id"]
    )
    op.alter_column("registro_falta", "disciplina_id", nullable=False)
    op.create_index("ix_registro_falta_disciplina_id", "registro_falta", ["disciplina_id"])


def downgrade() -> None:
    op.drop_column("registro_falta", "disciplina_id")
    op.drop_column("atividade_nota", "disciplina_id")
    op.drop_table("atribuicao_professor")
    op.drop_table("disciplina")
