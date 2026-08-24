"""unique atribuicao professor disciplina turma

Um professor só pode ter uma atribuição por (disciplina, turma). Antes disso
existia uma duplicata em produção (mesmo professor/disciplina/turma inserido
duas vezes), causando "chave duplicada" no React ao listar disciplinas da
turma. Remove duplicatas restantes e trava a constraint no banco para não
voltar a acontecer.

Revision ID: 8e73ed651f6f
Revises: c9658f112ff8
Create Date: 2026-07-10 08:22:48.038659

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8e73ed651f6f'
down_revision: Union[str, None] = 'c9658f112ff8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            DELETE FROM atribuicao_professor a
            USING atribuicao_professor b
            WHERE a.id > b.id
              AND a.escola_id = b.escola_id
              AND a.professor_id = b.professor_id
              AND a.disciplina_id = b.disciplina_id
              AND a.turma = b.turma
            """
        )
    )
    op.create_unique_constraint(
        "uq_atribuicao_professor_disciplina_turma",
        "atribuicao_professor",
        ["escola_id", "professor_id", "disciplina_id", "turma"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_atribuicao_professor_disciplina_turma", "atribuicao_professor", type_="unique"
    )
