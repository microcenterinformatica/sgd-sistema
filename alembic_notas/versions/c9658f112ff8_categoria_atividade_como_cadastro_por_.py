"""categoria atividade como cadastro por professor e disciplina

Transforma "categoria" de texto livre por atividade num cadastro próprio
(categoria_atividade), com peso fixo, por professor + disciplina. Assim o
peso passa a pertencer à categoria (não mais a cada atividade), e as
categorias já cadastradas por um professor numa disciplina ficam
disponíveis para reaproveitar em qualquer turma dessa disciplina.

Atividades existentes viram uma categoria por (escola, professor,
disciplina, categoria, peso) distintos, preservando o cálculo do boletim
já feito.

Revision ID: c9658f112ff8
Revises: 25f971e5882f
Create Date: 2026-07-10 01:50:30.800966

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9658f112ff8'
down_revision: Union[str, None] = '25f971e5882f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "categoria_atividade",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("escola_id", sa.Integer(), nullable=False),
        sa.Column("professor_id", sa.Integer(), nullable=True),
        sa.Column("disciplina_id", sa.Integer(), sa.ForeignKey("disciplina.id"), nullable=False),
        sa.Column("nome", sa.String(), nullable=False),
        sa.Column("peso", sa.Float(), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_categoria_atividade_escola_id", "categoria_atividade", ["escola_id"])
    op.create_index("ix_categoria_atividade_professor_id", "categoria_atividade", ["professor_id"])
    op.create_index("ix_categoria_atividade_disciplina_id", "categoria_atividade", ["disciplina_id"])

    op.add_column("atividade_nota", sa.Column("categoria_id", sa.Integer(), nullable=True))

    conn = op.get_bind()
    grupos = conn.execute(
        sa.text(
            "SELECT DISTINCT escola_id, professor_id, disciplina_id, categoria, peso FROM atividade_nota"
        )
    ).fetchall()
    for escola_id, professor_id, disciplina_id, categoria, peso in grupos:
        novo_id = conn.execute(
            sa.text(
                "INSERT INTO categoria_atividade (escola_id, professor_id, disciplina_id, nome, peso, ativo) "
                "VALUES (:escola_id, :professor_id, :disciplina_id, :nome, :peso, true) RETURNING id"
            ),
            {
                "escola_id": escola_id,
                "professor_id": professor_id,
                "disciplina_id": disciplina_id,
                "nome": categoria,
                "peso": peso,
            },
        ).scalar_one()

        filtro_professor = (
            "professor_id IS NULL" if professor_id is None else "professor_id = :professor_id"
        )
        params = {
            "cid": novo_id,
            "escola_id": escola_id,
            "disciplina_id": disciplina_id,
            "categoria": categoria,
            "peso": peso,
        }
        if professor_id is not None:
            params["professor_id"] = professor_id
        conn.execute(
            sa.text(
                "UPDATE atividade_nota SET categoria_id = :cid "
                "WHERE escola_id = :escola_id AND disciplina_id = :disciplina_id "
                f"AND categoria = :categoria AND peso = :peso AND {filtro_professor}"
            ),
            params,
        )

    op.alter_column("atividade_nota", "categoria_id", nullable=False)
    op.create_foreign_key(
        "fk_atividade_nota_categoria_id", "atividade_nota", "categoria_atividade", ["categoria_id"], ["id"]
    )
    op.create_index("ix_atividade_nota_categoria_id", "atividade_nota", ["categoria_id"])
    op.drop_column("atividade_nota", "categoria")
    op.drop_column("atividade_nota", "peso")


def downgrade() -> None:
    op.add_column("atividade_nota", sa.Column("categoria", sa.String(), nullable=True))
    op.add_column("atividade_nota", sa.Column("peso", sa.Float(), nullable=True))

    conn = op.get_bind()
    conn.execute(
        sa.text(
            "UPDATE atividade_nota a SET categoria = c.nome, peso = c.peso "
            "FROM categoria_atividade c WHERE a.categoria_id = c.id"
        )
    )

    op.alter_column("atividade_nota", "categoria", nullable=False)
    op.alter_column("atividade_nota", "peso", nullable=False)
    op.drop_constraint("fk_atividade_nota_categoria_id", "atividade_nota", type_="foreignkey")
    op.drop_index("ix_atividade_nota_categoria_id", table_name="atividade_nota")
    op.drop_column("atividade_nota", "categoria_id")
    op.drop_table("categoria_atividade")
