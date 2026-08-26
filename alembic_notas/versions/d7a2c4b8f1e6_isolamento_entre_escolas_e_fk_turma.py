"""isolamento entre escolas: FKs compostas (escola_id, X_id) para aluno/disciplina/
professor nas tabelas filhas, e FK composta no texto "turma" (bonus de integridade,
sem precisar migrar pra turma_id em todo lugar)

Depende da migration c3f9a1b5e8d4 (cadeia principal) ja ter rodado, que cria
UNIQUE(escola_id, id) em aluno e professor.

Revision ID: d7a2c4b8f1e6
Revises: b1e5f8a3c7d2
Create Date: 2026-08-26 09:20:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd7a2c4b8f1e6'
down_revision: Union[str, None] = 'b1e5f8a3c7d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint("uq_disciplina_escola_id", "disciplina", ["escola_id", "id"])
    op.create_unique_constraint("uq_turma_escola_id", "turma", ["escola_id", "id"])

    # -- disciplina: troca FK simples por composta (escola_id, disciplina_id) --
    for tabela, nome_fk_antigo in (
        ("atividade_nota", "fk_atividade_nota_disciplina_id"),
        ("categoria_atividade", "categoria_atividade_disciplina_id_fkey"),
        ("atribuicao_professor", "atribuicao_professor_disciplina_id_fkey"),
        ("conteudo_aula", "conteudo_aula_disciplina_id_fkey"),
        ("registro_falta", "fk_registro_falta_disciplina_id"),
        ("ajuste_nota", "ajuste_nota_disciplina_id_fkey"),
    ):
        op.drop_constraint(nome_fk_antigo, tabela, type_="foreignkey")
        op.create_foreign_key(
            f"{tabela}_disciplina_composta_fkey", tabela, "disciplina",
            ["escola_id", "disciplina_id"], ["escola_id", "id"],
        )

    # -- professor: troca FK simples por composta (escola_id, professor_id) --
    for tabela, nome_fk_antigo in (
        ("atividade_nota", "atividade_nota_professor_id_fkey"),
        ("categoria_atividade", "categoria_atividade_professor_id_fkey"),
        ("atribuicao_professor", "atribuicao_professor_professor_id_fkey"),
        ("conteudo_aula", "conteudo_aula_professor_id_fkey"),
    ):
        op.drop_constraint(nome_fk_antigo, tabela, type_="foreignkey")
        op.create_foreign_key(
            f"{tabela}_professor_composta_fkey", tabela, "professor",
            ["escola_id", "professor_id"], ["escola_id", "id"],
        )

    # -- aluno: troca FK simples por composta (escola_id, aluno_id) --
    for tabela, nome_fk_antigo in (
        ("registro_falta", "registro_falta_aluno_id_fkey"),
        ("ajuste_nota", "ajuste_nota_aluno_id_fkey"),
    ):
        op.drop_constraint(nome_fk_antigo, tabela, type_="foreignkey")
        op.create_foreign_key(
            f"{tabela}_aluno_composta_fkey", tabela, "aluno",
            ["escola_id", "aluno_id"], ["escola_id", "id"],
        )

    # -- bonus: FK composta no texto "turma" (Turma ja tem UNIQUE(escola_id, nome)
    # desde sempre) -- pega tenant-safety e barra turma inexistente/digitada errado,
    # sem precisar migrar pra turma_id em todo o sistema. `aluno` e da cadeia
    # principal, mas alteramos aqui porque a FK so faz sentido depois que a unique
    # de turma acima existe.
    for tabela in ("aluno", "atividade_nota", "atribuicao_professor", "conteudo_aula"):
        op.create_foreign_key(
            f"{tabela}_turma_fkey", tabela, "turma",
            ["escola_id", "turma"], ["escola_id", "nome"],
        )


def downgrade() -> None:
    for tabela in ("aluno", "atividade_nota", "atribuicao_professor", "conteudo_aula"):
        op.drop_constraint(f"{tabela}_turma_fkey", tabela, type_="foreignkey")

    for tabela, nome_fk_antigo in (
        ("registro_falta", "registro_falta_aluno_id_fkey"),
        ("ajuste_nota", "ajuste_nota_aluno_id_fkey"),
    ):
        op.drop_constraint(f"{tabela}_aluno_composta_fkey", tabela, type_="foreignkey")
        op.create_foreign_key(nome_fk_antigo, tabela, "aluno", ["aluno_id"], ["id"])

    for tabela, nome_fk_antigo in (
        ("atividade_nota", "atividade_nota_professor_id_fkey"),
        ("categoria_atividade", "categoria_atividade_professor_id_fkey"),
        ("atribuicao_professor", "atribuicao_professor_professor_id_fkey"),
        ("conteudo_aula", "conteudo_aula_professor_id_fkey"),
    ):
        op.drop_constraint(f"{tabela}_professor_composta_fkey", tabela, type_="foreignkey")
        op.create_foreign_key(nome_fk_antigo, tabela, "professor", ["professor_id"], ["id"])

    for tabela, nome_fk_antigo in (
        ("atividade_nota", "fk_atividade_nota_disciplina_id"),
        ("categoria_atividade", "categoria_atividade_disciplina_id_fkey"),
        ("atribuicao_professor", "atribuicao_professor_disciplina_id_fkey"),
        ("conteudo_aula", "conteudo_aula_disciplina_id_fkey"),
        ("registro_falta", "fk_registro_falta_disciplina_id"),
        ("ajuste_nota", "ajuste_nota_disciplina_id_fkey"),
    ):
        op.drop_constraint(f"{tabela}_disciplina_composta_fkey", tabela, type_="foreignkey")
        op.create_foreign_key(nome_fk_antigo, tabela, "disciplina", ["disciplina_id"], ["id"])

    op.drop_constraint("uq_turma_escola_id", "turma", type_="unique")
    op.drop_constraint("uq_disciplina_escola_id", "disciplina", type_="unique")
