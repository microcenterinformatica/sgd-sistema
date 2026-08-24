"""create initial tables

Revision ID: 4cf5e1b4da42
Revises:
Create Date: 2026-07-01 00:54:04.441204

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4cf5e1b4da42'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


papel_usuario_enum = sa.Enum(
    "admin_escola", "coordenacao", "professor", name="papelusuario"
)
tipo_registro_enum = sa.Enum("infracao", "merito", name="tiporegistro")


def upgrade() -> None:
    op.create_table(
        "escola",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nome", sa.String(), nullable=False),
        sa.Column("cnpj", sa.String(), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.create_table(
        "usuario",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("escola_id", sa.Integer(), sa.ForeignKey("escola.id"), nullable=False),
        sa.Column("nome", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("senha_hash", sa.String(), nullable=False),
        sa.Column("papel", papel_usuario_enum, nullable=False),
    )
    op.create_index("ix_usuario_escola_id", "usuario", ["escola_id"])
    op.create_index("ix_usuario_email", "usuario", ["email"], unique=True)

    op.create_table(
        "aluno",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("escola_id", sa.Integer(), sa.ForeignKey("escola.id"), nullable=False),
        sa.Column("nome", sa.String(), nullable=False),
        sa.Column("matricula", sa.String(), nullable=False),
        sa.Column("whatsapp_responsavel", sa.String(), nullable=True),
        sa.Column("observacoes_condutas", sa.String(), nullable=True),
        sa.Column("controle_trabalhos_notas", sa.String(), nullable=True),
        sa.Column("pontos_atuais", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("data_ultima_infracao", sa.DateTime(), nullable=True),
        sa.Column("data_ultima_recuperacao", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("escola_id", "matricula", name="uq_aluno_escola_matricula"),
    )
    op.create_index("ix_aluno_escola_id", "aluno", ["escola_id"])

    op.create_table(
        "regra_infracao",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("escola_id", sa.Integer(), sa.ForeignKey("escola.id"), nullable=False),
        sa.Column("descricao", sa.String(), nullable=False),
        sa.Column("peso", sa.Integer(), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_regra_infracao_escola_id", "regra_infracao", ["escola_id"])

    op.create_table(
        "punicao",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("escola_id", sa.Integer(), sa.ForeignKey("escola.id"), nullable=False),
        sa.Column("descricao", sa.String(), nullable=False),
        sa.Column("pontuacao_minima", sa.Integer(), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_punicao_escola_id", "punicao", ["escola_id"])

    op.create_table(
        "professor",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("escola_id", sa.Integer(), sa.ForeignKey("escola.id"), nullable=False),
        sa.Column("nome", sa.String(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), sa.ForeignKey("usuario.id"), nullable=True),
    )
    op.create_index("ix_professor_escola_id", "professor", ["escola_id"])

    op.create_table(
        "registro_disciplinar",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("aluno_id", sa.Integer(), sa.ForeignKey("aluno.id"), nullable=False),
        sa.Column("tipo", tipo_registro_enum, nullable=False),
        sa.Column("regra_id", sa.Integer(), sa.ForeignKey("regra_infracao.id"), nullable=True),
        sa.Column("descricao", sa.String(), nullable=False),
        sa.Column("peso", sa.Integer(), nullable=False),
        sa.Column("data_hora", sa.DateTime(), nullable=False),
        sa.Column("observacao", sa.String(), nullable=True),
        sa.Column("professor_id", sa.Integer(), sa.ForeignKey("professor.id"), nullable=True),
        sa.Column("registrado_por_usuario_id", sa.Integer(), sa.ForeignKey("usuario.id"), nullable=False),
    )
    op.create_index("ix_registro_disciplinar_aluno_id", "registro_disciplinar", ["aluno_id"])

    op.create_table(
        "configuracao_recuperacao",
        sa.Column("escola_id", sa.Integer(), sa.ForeignKey("escola.id"), primary_key=True),
        sa.Column("dias_para_recuperacao", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("pontos_recuperacao", sa.Integer(), nullable=False, server_default="2"),
    )


def downgrade() -> None:
    op.drop_table("configuracao_recuperacao")
    op.drop_table("registro_disciplinar")
    op.drop_table("professor")
    op.drop_table("punicao")
    op.drop_table("regra_infracao")
    op.drop_table("aluno")
    op.drop_table("usuario")
    op.drop_table("escola")
    tipo_registro_enum.drop(op.get_bind(), checkfirst=True)
    papel_usuario_enum.drop(op.get_bind(), checkfirst=True)
