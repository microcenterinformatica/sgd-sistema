from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from sqlmodel import SQLModel

from alembic import context
from app.core.config import settings
import app.models  # noqa: F401  (registers only this project's own tables)

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", settings.database_url)

target_metadata = SQLModel.metadata

# Este banco é compartilhado com o projeto SGD-WEB. Duas proteções para
# nunca mexer nas tabelas do outro projeto:
#   1. version_table próprio, para não brigar com o controle de migração
#      do SGD-WEB (que usa a tabela "alembic_version" padrão).
#   2. include_object restringe qualquer autogenerate às tabelas que
#      este projeto realmente possui.
VERSION_TABLE = "alembic_version_notas"
TABELAS_PROPRIAS = {
    "atividade_nota",
    "lancamento_nota",
    "registro_falta",
    "disciplina",
    "atribuicao_professor",
    "configuracao_periodo",
    "categoria_atividade",
    "conteudo_aula",
}


def include_object(object, name, type_, reflected, compare_to):
    if type_ == "table":
        return name in TABELAS_PROPRIAS
    return True


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table=VERSION_TABLE,
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table=VERSION_TABLE,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
