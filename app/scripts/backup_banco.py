"""Gera um backup em SQL (INSERT statements, ordem segura de FK) do banco.

Não depende de pg_dump/psql (não instalados nesta máquina) — lê os dados via
SQLAlchemy/psycopg2 e escreve um arquivo .sql que pode ser reaplicado depois
(rodando as migrações do Alembic pra criar o schema vazio e depois executando
esse .sql pra repovoar os dados).

Uso:
    DATABASE_URL="postgresql://usuario:senha@host/banco?sslmode=require" \
        python -m app.scripts.backup_banco --destino "C:/sistemas/bkp/banco_2026-08-30.sql"

Se --destino não for informado, salva em C:/sistemas/bkp/banco_<data-de-hoje>.sql.
Use sempre o endpoint DIRETO do Neon (sem "-pooler" no host) — o pooler tem um
bug conhecido de search_path (ver memória do projeto).
"""

import argparse
import datetime
import os

import psycopg2
from psycopg2 import sql
from sqlmodel import SQLModel

import app.models  # noqa: F401  -- popula o metadata com todas as tabelas


def gerar_backup(database_url: str, destino: str) -> None:
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    tabelas = [t.name for t in SQLModel.metadata.sorted_tables]

    saida = [
        "-- Backup do banco de dados do SGD",
        f"-- Gerado em {datetime.datetime.now().isoformat()}",
        "-- Ordem das tabelas respeitando FKs (SQLModel.metadata.sorted_tables)",
        "",
        "BEGIN;",
        "",
    ]

    for tabela in tabelas:
        cur.execute(sql.SQL("SELECT * FROM {}").format(sql.Identifier(tabela)))
        colunas = [desc[0] for desc in cur.description]
        linhas = cur.fetchall()
        saida.append(f"-- Tabela: {tabela} ({len(linhas)} linha(s))")
        if linhas:
            col_ident = sql.SQL(", ").join(sql.Identifier(c) for c in colunas)
            for linha in linhas:
                insert_stmt = cur.mogrify(
                    sql.SQL("INSERT INTO {} ({}) VALUES ({});").format(
                        sql.Identifier(tabela),
                        col_ident,
                        sql.SQL(", ").join(sql.Placeholder() * len(linha)),
                    ),
                    linha,
                )
                saida.append(insert_stmt.decode("utf-8"))
        saida.append("")

    saida.append("COMMIT;")

    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with open(destino, "w", encoding="utf-8") as f:
        f.write("\n".join(saida))

    cur.close()
    conn.close()

    print(f"Backup salvo em {destino}")
    print(f"Tamanho: {os.path.getsize(destino)} bytes")
    print(f"Total de tabelas: {len(tabelas)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Backup em SQL do banco do SGD")
    parser.add_argument(
        "--destino",
        default=None,
        help="Caminho do arquivo .sql de saída (padrão: C:/sistemas/bkp/banco_<hoje>.sql)",
    )
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("Defina a variável de ambiente DATABASE_URL antes de rodar este script.")

    destino = args.destino or f"C:/sistemas/bkp/banco_{datetime.date.today().isoformat()}.sql"
    gerar_backup(database_url, destino)


if __name__ == "__main__":
    main()
