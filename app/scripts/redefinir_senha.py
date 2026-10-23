"""Redefine a senha de um usuário existente.

Uso (na raiz do projeto, com o .venv ativo):
    python -m app.scripts.redefinir_senha admin@escolapiloto.com

A senha nova é pedida no terminal (não aparece na tela nem fica no histórico).
Mostra o host do banco antes de gravar, para não alterar produção por engano.
"""
import argparse
import getpass

from sqlalchemy import func
from sqlmodel import Session, select

from app.core.security import hash_senha
from app.db.session import engine
from app.models.usuario import Usuario


def redefinir_senha(email: str) -> None:
    print(f"Banco: {engine.url.host}/{engine.url.database}")
    with Session(engine) as session:
        usuario = session.exec(select(Usuario).where(func.lower(Usuario.email) == email.strip().lower())).first()
        if usuario is None:
            print(f"Usuário {email} não encontrado.")
            return
        print(f"Usuário: {usuario.nome} ({usuario.papel.value}, escola {usuario.escola_id})")
        if input("Confirmar redefinição? (s/n) ").strip().lower() != "s":
            print("Cancelado.")
            return
        senha = getpass.getpass("Nova senha: ")
        if len(senha) < 4 or senha != getpass.getpass("Repita a senha: "):
            print("Senhas diferentes ou curtas demais. Nada foi alterado.")
            return
        usuario.senha_hash = hash_senha(senha)
        session.add(usuario)
        session.commit()
        print("Senha redefinida.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Redefine a senha de um usuário")
    parser.add_argument("email")
    redefinir_senha(parser.parse_args().email)
