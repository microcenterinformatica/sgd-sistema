"""cria ano_letivo e matricula_turma (historico de turma por ano), com backfill

Aluno.turma continua funcionando exatamente como hoje (nao e alterado). Esta
migration adiciona um registro historico paralelo que nunca e sobrescrito: uma
linha de matricula_turma por aluno/ano_letivo. Faz backfill do ano corrente
para escolas/alunos ja existentes, a partir da turma atual de cada aluno.

Revision ID: b1e5f8a3c7d2
Revises: a9d4e7f2c8b1
Create Date: 2026-08-26 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1e5f8a3c7d2'
down_revision: Union[str, None] = 'a9d4e7f2c8b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ano_letivo",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("escola_id", sa.Integer(), sa.ForeignKey("escola.id"), nullable=False),
        sa.Column("ano", sa.Integer(), nullable=False),
        sa.Column("data_inicio", sa.Date(), nullable=True),
        sa.Column("data_fim", sa.Date(), nullable=True),
        sa.Column("situacao", sa.String(), nullable=False, server_default="aberto"),
        sa.UniqueConstraint("escola_id", "ano", name="uq_ano_letivo_escola_ano"),
    )
    op.create_index("ix_ano_letivo_escola_id", "ano_letivo", ["escola_id"])

    op.create_table(
        "matricula_turma",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("aluno_id", sa.Integer(), sa.ForeignKey("aluno.id"), nullable=False),
        sa.Column("turma_id", sa.Integer(), sa.ForeignKey("turma.id"), nullable=False),
        sa.Column("ano_letivo_id", sa.Integer(), sa.ForeignKey("ano_letivo.id"), nullable=False),
        sa.Column("numero_chamada", sa.Integer(), nullable=True),
        sa.Column("situacao", sa.String(), nullable=False, server_default="ativa"),
        sa.Column("data_entrada", sa.Date(), nullable=False, server_default=sa.text("CURRENT_DATE")),
        sa.UniqueConstraint("aluno_id", "ano_letivo_id", name="uq_matricula_aluno_ano"),
    )
    op.create_index("ix_matricula_turma_aluno_id", "matricula_turma", ["aluno_id"])
    op.create_index("ix_matricula_turma_turma_id", "matricula_turma", ["turma_id"])
    op.create_index("ix_matricula_turma_ano_letivo_id", "matricula_turma", ["ano_letivo_id"])
    op.create_index(
        "uq_matricula_turma_ano_numero_chamada", "matricula_turma",
        ["turma_id", "ano_letivo_id", "numero_chamada"], unique=True,
        postgresql_where=sa.text("numero_chamada IS NOT NULL"),
    )

    # backfill: um ano letivo "corrente" por escola + uma matricula por aluno com turma
    op.execute("""
        INSERT INTO ano_letivo (escola_id, ano, situacao)
        SELECT id, EXTRACT(YEAR FROM CURRENT_DATE)::int, 'aberto' FROM escola
    """)
    op.execute("""
        INSERT INTO matricula_turma (aluno_id, turma_id, ano_letivo_id, numero_chamada)
        SELECT a.id, t.id, al.id, a.numero_chamada
        FROM aluno a
        JOIN turma t ON t.escola_id = a.escola_id AND t.nome = a.turma
        JOIN ano_letivo al ON al.escola_id = a.escola_id AND al.ano = EXTRACT(YEAR FROM CURRENT_DATE)::int
        WHERE a.turma IS NOT NULL
    """)


def downgrade() -> None:
    op.drop_table("matricula_turma")
    op.drop_table("ano_letivo")
