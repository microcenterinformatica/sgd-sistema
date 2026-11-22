"""criar cartao_aluno e transacao_veracoin (feirinha)

Só cria tabelas novas: não altera nenhuma tabela ou valor existente
(pontos, méritos, ranking ficam intocados).

Revision ID: e8b4c2d7f1a9
Revises: d3e9f2a6b1c7
Create Date: 2026-11-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8b4c2d7f1a9'
down_revision: Union[str, None] = 'd3e9f2a6b1c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cartao_aluno",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("escola_id", sa.Integer(), sa.ForeignKey("escola.id"), nullable=False),
        sa.Column("aluno_id", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(), nullable=False, unique=True),
        sa.Column("numero", sa.Integer(), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.Column("desativado_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["escola_id", "aluno_id"], ["aluno.escola_id", "aluno.id"], name="cartao_aluno_aluno_fkey"
        ),
        sa.UniqueConstraint("escola_id", "numero", name="uq_cartao_aluno_escola_numero"),
    )
    op.create_index("ix_cartao_aluno_escola_id", "cartao_aluno", ["escola_id"])
    op.create_index("ix_cartao_aluno_aluno_id", "cartao_aluno", ["aluno_id"])
    op.create_index(
        "uq_cartao_aluno_um_ativo_por_aluno",
        "cartao_aluno",
        ["aluno_id"],
        unique=True,
        postgresql_where=sa.text("ativo = true"),
    )

    op.create_table(
        "transacao_veracoin",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("escola_id", sa.Integer(), sa.ForeignKey("escola.id"), nullable=False),
        sa.Column("aluno_id", sa.Integer(), nullable=False),
        sa.Column("cartao_id", sa.Integer(), sa.ForeignKey("cartao_aluno.id"), nullable=True),
        sa.Column("tipo", sa.String(), nullable=False),
        sa.Column("valor", sa.Integer(), nullable=False),
        sa.Column("descricao", sa.String(), nullable=True),
        sa.Column("operador_id", sa.Integer(), sa.ForeignKey("usuario.id"), nullable=False),
        sa.Column("origem", sa.String(), nullable=False, server_default="feirinha"),
        sa.Column("estorno_de_id", sa.Integer(), sa.ForeignKey("transacao_veracoin.id"), nullable=True),
        sa.Column("chave_idempotencia", sa.String(), nullable=True, unique=True),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["escola_id", "aluno_id"], ["aluno.escola_id", "aluno.id"], name="transacao_veracoin_aluno_fkey"
        ),
        sa.CheckConstraint("valor > 0", name="ck_transacao_veracoin_valor_positivo"),
        sa.CheckConstraint(
            "(tipo = 'estorno') = (estorno_de_id IS NOT NULL)", name="ck_transacao_veracoin_estorno_referencia"
        ),
    )
    op.create_index("ix_transacao_veracoin_escola_id", "transacao_veracoin", ["escola_id"])
    op.create_index("ix_transacao_veracoin_aluno_id", "transacao_veracoin", ["aluno_id"])
    op.create_index("ix_transacao_veracoin_operador_id", "transacao_veracoin", ["operador_id"])
    op.create_index("ix_transacao_veracoin_criado_em", "transacao_veracoin", ["criado_em"])
    op.create_index("uq_transacao_veracoin_estorno_de", "transacao_veracoin", ["estorno_de_id"], unique=True)


def downgrade() -> None:
    op.drop_table("transacao_veracoin")
    op.drop_table("cartao_aluno")
