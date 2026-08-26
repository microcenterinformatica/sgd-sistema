"""adiciona FKs, UNIQUE e CHECK que faltavam no modulo de notas + corrige configuracao_periodo

O modulo de notas foi originalmente um projeto separado (SGD-NOTAS) fundido depois no
SGD principal; as FKs que existiam no modelo original nao foram replicadas nas tabelas
novas. Esta migration fecha essas lacunas (auditoria confirmou zero violacao de dados
existentes, exceto 3 linhas orfas em lancamento_nota que sao limpas antes das FKs).

Revision ID: a9d4e7f2c8b1
Revises: d3f7a2b9c1e4
Create Date: 2026-08-26 08:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9d4e7f2c8b1'
down_revision: Union[str, None] = 'd3f7a2b9c1e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 2.0 limpeza: notas de alunos ja excluidos do sistema
    op.execute("DELETE FROM lancamento_nota WHERE aluno_id NOT IN (SELECT id FROM aluno)")

    # 2.1 FKs de escola_id
    for tabela in (
        "disciplina", "turma", "atividade_nota", "categoria_atividade",
        "conteudo_aula", "atribuicao_professor", "ajuste_nota", "registro_falta",
    ):
        op.create_foreign_key(f"{tabela}_escola_id_fkey", tabela, "escola", ["escola_id"], ["id"])

    # 2.2 FKs de relacionamento
    op.create_foreign_key("lancamento_nota_aluno_id_fkey", "lancamento_nota", "aluno", ["aluno_id"], ["id"])
    op.create_foreign_key("registro_falta_aluno_id_fkey", "registro_falta", "aluno", ["aluno_id"], ["id"])
    op.create_foreign_key(
        "registro_falta_registrado_por_usuario_id_fkey", "registro_falta", "usuario",
        ["registrado_por_usuario_id"], ["id"],
    )
    op.create_foreign_key(
        "conteudo_aula_registrado_por_usuario_id_fkey", "conteudo_aula", "usuario",
        ["registrado_por_usuario_id"], ["id"],
    )
    op.create_foreign_key(
        "atribuicao_professor_professor_id_fkey", "atribuicao_professor", "professor",
        ["professor_id"], ["id"],
    )
    op.create_foreign_key("atividade_nota_professor_id_fkey", "atividade_nota", "professor", ["professor_id"], ["id"])
    op.create_foreign_key(
        "categoria_atividade_professor_id_fkey", "categoria_atividade", "professor",
        ["professor_id"], ["id"],
    )
    op.create_foreign_key("conteudo_aula_professor_id_fkey", "conteudo_aula", "professor", ["professor_id"], ["id"])

    # 2.3 unicidade
    op.create_unique_constraint(
        "uq_lancamento_nota_atividade_aluno", "lancamento_nota", ["atividade_id", "aluno_id"]
    )
    op.create_index(
        "uq_registro_falta_aluno_data_disciplina", "registro_falta",
        ["aluno_id", "data", sa.text("COALESCE(disciplina_id, -1)")], unique=True,
    )
    op.create_unique_constraint("uq_disciplina_escola_nome", "disciplina", ["escola_id", "nome"])

    # 2.4 checks
    op.create_check_constraint(
        "ck_lancamento_nota_faixa", "lancamento_nota", "nota IS NULL OR (nota >= 0 AND nota <= 10)"
    )
    op.create_check_constraint("ck_ajuste_nota_faixa", "ajuste_nota", "nota_ajustada >= 0 AND nota_ajustada <= 10")
    op.create_check_constraint("ck_ajuste_nota_trimestre", "ajuste_nota", "trimestre BETWEEN 1 AND 3")
    op.create_check_constraint("ck_categoria_atividade_peso", "categoria_atividade", "peso > 0")
    op.create_check_constraint(
        "ck_atividade_nota_data_entrega", "atividade_nota", "data_entrega IS NULL OR data_entrega >= data"
    )

    # 2.5 indices
    op.create_index("ix_registro_falta_aluno_data", "registro_falta", ["aluno_id", "data"])
    op.create_index("ix_lancamento_nota_aluno", "lancamento_nota", ["aluno_id"])
    op.create_index("ix_atividade_nota_categoria", "atividade_nota", ["categoria_id"])

    # Etapa 3 - configuracao_periodo.escola_id tinha sequence propria em vez de FK
    op.execute("ALTER TABLE configuracao_periodo ALTER COLUMN escola_id DROP DEFAULT")
    op.execute("DROP SEQUENCE IF EXISTS configuracao_periodo_escola_id_seq")
    op.create_foreign_key(
        "configuracao_periodo_escola_id_fkey", "configuracao_periodo", "escola",
        ["escola_id"], ["id"], ondelete="CASCADE",
    )
    op.create_check_constraint(
        "ck_configuracao_periodo_ordem", "configuracao_periodo",
        "(trimestre1_inicio IS NULL OR trimestre1_fim IS NULL OR trimestre1_inicio <= trimestre1_fim) AND "
        "(trimestre2_inicio IS NULL OR trimestre2_fim IS NULL OR trimestre2_inicio <= trimestre2_fim) AND "
        "(trimestre3_inicio IS NULL OR trimestre3_fim IS NULL OR trimestre3_inicio <= trimestre3_fim)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_configuracao_periodo_ordem", "configuracao_periodo", type_="check")
    op.drop_constraint("configuracao_periodo_escola_id_fkey", "configuracao_periodo", type_="foreignkey")
    op.execute(
        "CREATE SEQUENCE IF NOT EXISTS configuracao_periodo_escola_id_seq OWNED BY configuracao_periodo.escola_id"
    )
    op.execute(
        "ALTER TABLE configuracao_periodo ALTER COLUMN escola_id "
        "SET DEFAULT nextval('configuracao_periodo_escola_id_seq')"
    )

    op.drop_index("ix_atividade_nota_categoria", table_name="atividade_nota")
    op.drop_index("ix_lancamento_nota_aluno", table_name="lancamento_nota")
    op.drop_index("ix_registro_falta_aluno_data", table_name="registro_falta")

    op.drop_constraint("ck_atividade_nota_data_entrega", "atividade_nota", type_="check")
    op.drop_constraint("ck_categoria_atividade_peso", "categoria_atividade", type_="check")
    op.drop_constraint("ck_ajuste_nota_trimestre", "ajuste_nota", type_="check")
    op.drop_constraint("ck_ajuste_nota_faixa", "ajuste_nota", type_="check")
    op.drop_constraint("ck_lancamento_nota_faixa", "lancamento_nota", type_="check")

    op.drop_constraint("uq_disciplina_escola_nome", "disciplina", type_="unique")
    op.drop_index("uq_registro_falta_aluno_data_disciplina", table_name="registro_falta")
    op.drop_constraint("uq_lancamento_nota_atividade_aluno", "lancamento_nota", type_="unique")

    op.drop_constraint("conteudo_aula_professor_id_fkey", "conteudo_aula", type_="foreignkey")
    op.drop_constraint("categoria_atividade_professor_id_fkey", "categoria_atividade", type_="foreignkey")
    op.drop_constraint("atividade_nota_professor_id_fkey", "atividade_nota", type_="foreignkey")
    op.drop_constraint("atribuicao_professor_professor_id_fkey", "atribuicao_professor", type_="foreignkey")
    op.drop_constraint("conteudo_aula_registrado_por_usuario_id_fkey", "conteudo_aula", type_="foreignkey")
    op.drop_constraint("registro_falta_registrado_por_usuario_id_fkey", "registro_falta", type_="foreignkey")
    op.drop_constraint("registro_falta_aluno_id_fkey", "registro_falta", type_="foreignkey")
    op.drop_constraint("lancamento_nota_aluno_id_fkey", "lancamento_nota", type_="foreignkey")

    for tabela in (
        "registro_falta", "ajuste_nota", "atribuicao_professor", "conteudo_aula",
        "categoria_atividade", "atividade_nota", "turma", "disciplina",
    ):
        op.drop_constraint(f"{tabela}_escola_id_fkey", tabela, type_="foreignkey")
