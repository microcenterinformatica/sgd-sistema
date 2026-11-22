"""Testes rodam num banco PostgreSQL LOCAL separado (`sgd_test`), recriado a
cada sessão de testes. Nunca apontam para o banco de desenvolvimento nem para
produção: o nome do banco é trocado e o host precisa ser local."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlmodel import Session, SQLModel

import app.models  # noqa: F401  (registra todas as tabelas no metadata)
from app.api.deps import get_session
from app.core.config import settings
from app.core.security import criar_access_token
from app.main import app
from app.models.aluno import Aluno
from app.models.escola import Escola
from app.models.registro_disciplinar import RegistroDisciplinar, TipoRegistro
from app.models.turma import Turma
from app.models.usuario import PapelUsuario, Usuario

NOME_BANCO_TESTE = "sgd_test"

url_base = make_url(settings.database_url)
if url_base.host not in ("localhost", "127.0.0.1"):
    raise RuntimeError("Testes só rodam contra PostgreSQL local.")
URL_TESTE = url_base.set(database=NOME_BANCO_TESTE)


def _recriar_banco():
    admin = create_engine(url_base.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {NOME_BANCO_TESTE} WITH (FORCE)"))
        conn.execute(text(f"CREATE DATABASE {NOME_BANCO_TESTE}"))
    admin.dispose()


@pytest.fixture(scope="session")
def engine():
    _recriar_banco()
    eng = create_engine(URL_TESTE, pool_size=10)
    SQLModel.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture()
def session(engine):
    with Session(engine) as s:
        yield s


@pytest.fixture()
def client(engine):
    def _get_session():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = _get_session
    yield TestClient(app)
    app.dependency_overrides.clear()


_contador = {"n": 0}


def _unico(prefixo: str) -> str:
    _contador["n"] += 1
    return f"{prefixo}{_contador['n']}"


@pytest.fixture()
def fabrica(session):
    """Cria escola, turma, usuários e alunos com créditos de mérito."""

    class Fabrica:
        def escola(self):
            e = Escola(nome=_unico("Escola "))
            session.add(e)
            session.commit()
            session.refresh(e)
            return e

        def turma(self, escola, nome="5A"):
            t = Turma(escola_id=escola.id, nome=nome)
            session.add(t)
            session.commit()
            session.refresh(t)
            return t

        def usuario(self, escola, papel=PapelUsuario.admin_escola):
            u = Usuario(
                escola_id=escola.id, nome="Teste", email=_unico("u") + "@t.com", senha_hash="x", papel=papel
            )
            session.add(u)
            session.commit()
            session.refresh(u)
            return u

        def headers(self, usuario):
            token = criar_access_token(
                {"sub": str(usuario.id), "escola_id": usuario.escola_id, "papel": usuario.papel.value}
            )
            return {"Authorization": f"Bearer {token}"}

        def aluno(self, escola, turma, veracoins=0, nome=None):
            a = Aluno(escola_id=escola.id, nome=nome or _unico("Aluno "), matricula=_unico("m"), turma=turma.nome)
            session.add(a)
            session.commit()
            session.refresh(a)
            if veracoins:
                # Mérito é gravado com peso negativo (vira positivo no Patrimônio Disciplinar).
                session.add(
                    RegistroDisciplinar(aluno_id=a.id, tipo=TipoRegistro.merito, descricao="Mérito", peso=-veracoins)
                )
                session.commit()
            return a

    return Fabrica()
