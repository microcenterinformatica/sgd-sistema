import uuid

import pytest

from app.models.aluno import Aluno
from app.models.regra_infracao import RegraInfracao
from app.models.registro_disciplinar import RegistroDisciplinar, TipoRegistro
from app.models.usuario import PapelUsuario
from app.services.pontuacao import DESCRICAO_BONUS_BOM_COMPORTAMENTO, DESCRICAO_RECUPERACAO_AUTOMATICA


@pytest.fixture()
def cenario(client, fabrica, session):
    escola = fabrica.escola()
    turma = fabrica.turma(escola)
    aluno = fabrica.aluno(escola, turma)
    aluno_id, escola_id, turma_id = aluno.id, escola.id, turma.id
    admin = fabrica.headers(fabrica.usuario(escola))

    class Cenario:
        def outro(self, papel):
            return fabrica.headers(fabrica.usuario(escola, papel=papel))

        def merito(self, pontos):
            r = client.post("/registros/merito", json={"aluno_id": aluno_id, "pontos_bonus": pontos}, headers=admin)
            assert r.status_code == 201, r.text
            return r.json()["registro"]["id"]

        def infracao(self, peso):
            regra = RegraInfracao(escola_id=escola_id, descricao="Regra", peso=peso)
            session.add(regra)
            session.commit()
            r = client.post("/registros/infracao", json={"aluno_id": aluno_id, "regra_id": regra.id}, headers=admin)
            assert r.status_code == 201, r.text
            return r.json()["registro"]["id"]

        def gravar(self, descricao, peso):
            reg = RegistroDisciplinar(aluno_id=aluno_id, tipo=TipoRegistro.merito, descricao=descricao, peso=peso)
            session.add(reg)
            session.commit()
            return reg.id

        def editar(self, rid, pontos, headers=None, **extra):
            return client.put(
                f"/registros/{rid}/merito", json={"pontos_bonus": pontos, **extra}, headers=headers or admin
            )

        def excluir(self, rid, headers=None, confirmar=False):
            q = "?confirmar_saldo_negativo=true" if confirmar else ""
            return client.delete(f"/registros/{rid}{q}", headers=headers or admin)

        def pontos(self):
            session.expire_all()
            return session.get(Aluno, aluno_id).pontos_atuais

        def veracoins(self):
            itens = client.get("/ranking", headers=admin).json()
            return next(i for i in itens if i["aluno_id"] == aluno_id)["pontuacao"]

        def gastar(self, valor):
            assert client.post(f"/cartoes/gerar?turma_id={turma_id}", headers=admin).status_code == 200
            cartao = client.get(f"/cartoes/imprimir?turma_id={turma_id}", headers=admin).json()["cartoes"][0]
            r = client.post(
                "/feirinha/debito",
                json={"token": cartao["token"], "valor": valor, "chave_idempotencia": str(uuid.uuid4())},
                headers=admin,
            )
            assert r.status_code == 200, r.text

    return Cenario()


def test_caso_real_aluno_sem_indisciplina_nunca_ganha_pontos(cenario):
    """O que aconteceu em produção: méritos altos dados, alterados e excluídos."""
    ids = [cenario.merito(12) for _ in range(4)]
    assert cenario.pontos() == 0
    assert cenario.editar(ids[0], 1).status_code == 200
    assert cenario.pontos() == 0
    for rid in ids:
        assert cenario.excluir(rid).status_code == 204
        assert cenario.pontos() == 0


def test_alterar_para_menos_devolve_so_a_indisciplina_real(cenario):
    cenario.infracao(8)
    merito = cenario.merito(50)
    assert cenario.pontos() == 0
    r = cenario.editar(merito, 3, observacao="corrigido")
    assert r.status_code == 200, r.text
    assert r.json()["pontos_atuais"] == cenario.pontos() == 5
    assert r.json()["registro"]["observacao"] == "corrigido"
    assert cenario.excluir(merito).status_code == 204
    assert cenario.pontos() == 8


def test_alterar_para_mais_nunca_fica_negativo(cenario):
    cenario.infracao(8)
    merito = cenario.merito(3)
    assert cenario.editar(merito, 20).json()["pontos_atuais"] == 0


def test_alterar_muda_os_veracoins(cenario):
    merito = cenario.merito(50)
    assert cenario.editar(merito, 5).status_code == 200
    assert cenario.veracoins() == 5


@pytest.mark.parametrize("papel", [PapelUsuario.professor, PapelUsuario.coordenacao])
def test_so_admin_altera_ou_exclui_merito(cenario, papel):
    merito = cenario.merito(5)
    h = cenario.outro(papel)
    assert cenario.editar(merito, 2, headers=h).status_code == 403
    assert cenario.excluir(merito, headers=h).status_code == 403
    assert cenario.veracoins() == 5


def test_coordenacao_continua_excluindo_indisciplina(cenario):
    infracao = cenario.infracao(4)
    assert cenario.excluir(infracao, headers=cenario.outro(PapelUsuario.coordenacao)).status_code == 204
    assert cenario.pontos() == 0


def test_admin_de_outra_escola_nao_altera_nem_exclui(cenario, fabrica):
    merito = cenario.merito(5)
    h = fabrica.headers(fabrica.usuario(fabrica.escola()))
    assert cenario.editar(merito, 2, headers=h).status_code == 404
    assert cenario.excluir(merito, headers=h).status_code == 404


@pytest.mark.parametrize("valor", [0, -3])
def test_valor_invalido(cenario, valor):
    assert cenario.editar(cenario.merito(5), valor).status_code == 400


@pytest.mark.parametrize(
    "descricao",
    [DESCRICAO_RECUPERACAO_AUTOMATICA, DESCRICAO_BONUS_BOM_COMPORTAMENTO, "PONTO DE MÉRITO/BÔNUS (turma)"],
)
def test_nao_altera_valor_de_registro_automatico_ou_de_turma(cenario, descricao):
    assert cenario.editar(cenario.gravar(descricao, -1), 9).status_code == 400


def test_nao_altera_indisciplina_como_merito(cenario):
    assert cenario.editar(cenario.infracao(4), 2).status_code == 400
    assert cenario.pontos() == 4


def test_avisa_quando_ja_gastou_na_feirinha(cenario):
    cenario.infracao(3)
    merito = cenario.merito(20)
    cenario.gastar(10)

    r = cenario.editar(merito, 5)
    assert r.status_code == 409 and "saldo negativo de 8" in r.json()["detail"]
    assert cenario.excluir(merito).status_code == 409
    # Nada mudou enquanto o admin não confirmou.
    assert (cenario.pontos(), cenario.veracoins()) == (0, 17)

    assert cenario.editar(merito, 5, confirmar_saldo_negativo=True).status_code == 200
    assert cenario.veracoins() == 2
    assert cenario.excluir(merito, confirmar=True).status_code == 204
    assert cenario.pontos() == 3


def test_nao_avisa_quando_o_saldo_cobre_o_gasto(cenario):
    merito = cenario.merito(20)
    cenario.gastar(10)
    assert cenario.editar(merito, 10).status_code == 200
