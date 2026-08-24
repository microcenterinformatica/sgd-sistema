"""Script de onboarding: cria uma nova escola (tenant), seu primeiro usuário
admin_escola e os catálogos padrão de regras/punições (ponto de partida,
customizável depois pela própria escola).

Uso:
    python -m app.scripts.criar_escola --nome "Escola Barreto Coelho" \
        --admin-nome "Maria Silva" --admin-email maria@escola.com --admin-senha "senha123"
"""

import argparse

from sqlmodel import Session, select

from app.core.security import hash_senha
from app.db.session import engine
from app.models.configuracao_recuperacao import ConfiguracaoRecuperacao
from app.models.escola import Escola
from app.models.punicao import Punicao
from app.models.regra_infracao import RegraInfracao
from app.models.usuario import PapelUsuario, Usuario

REGRAS_PADRAO = [
    ("Atraso na entrada", 1),
    ("Uso de celular em sala sem autorização", 2),
    ("Não realização de tarefas", 2),
    ("Desrespeito a professor ou colega", 5),
    ("Briga ou agressão", 10),
]

PUNICOES_PADRAO = [
    ("Advertência verbal", 3),
    ("Advertência escrita", 6),
    ("Suspensão", 10),
    ("Encaminhamento à direção / Conselho escolar", 15),
]


def criar_escola(nome: str, cnpj: str | None, admin_nome: str, admin_email: str, admin_senha: str) -> None:
    with Session(engine) as session:
        ja_existe = session.exec(select(Usuario).where(Usuario.email == admin_email)).first()
        if ja_existe is not None:
            raise SystemExit(f"Já existe um usuário com o email {admin_email}")

        escola = Escola(nome=nome, cnpj=cnpj)
        session.add(escola)
        session.commit()
        session.refresh(escola)

        admin = Usuario(
            escola_id=escola.id,
            nome=admin_nome,
            email=admin_email,
            senha_hash=hash_senha(admin_senha),
            papel=PapelUsuario.admin_escola,
        )
        session.add(admin)

        session.add(ConfiguracaoRecuperacao(escola_id=escola.id))

        for descricao, peso in REGRAS_PADRAO:
            session.add(RegraInfracao(escola_id=escola.id, descricao=descricao, peso=peso))

        for descricao, pontuacao_minima in PUNICOES_PADRAO:
            session.add(Punicao(escola_id=escola.id, descricao=descricao, pontuacao_minima=pontuacao_minima))

        session.commit()

        print(f"Escola '{escola.nome}' criada com id={escola.id}")
        print(f"Usuário admin_escola criado: {admin_email}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Cadastra uma nova escola (tenant) no SGD")
    parser.add_argument("--nome", required=True, help="Nome da escola")
    parser.add_argument("--cnpj", default=None, help="CNPJ da escola (opcional)")
    parser.add_argument("--admin-nome", required=True, help="Nome do primeiro usuário admin_escola")
    parser.add_argument("--admin-email", required=True, help="Email de login do admin_escola")
    parser.add_argument("--admin-senha", required=True, help="Senha do admin_escola")
    args = parser.parse_args()

    criar_escola(args.nome, args.cnpj, args.admin_nome, args.admin_email, args.admin_senha)


if __name__ == "__main__":
    main()
