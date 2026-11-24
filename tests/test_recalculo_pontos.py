from datetime import datetime, timedelta

import pytest

from app.models.aluno import Aluno
from app.models.regra_infracao import RegraInfracao
from app.models.registro_disciplinar import RegistroDisciplinar, TipoRegistro
from app.services.pontuacao import DESCRICAO_BONUS_BOM_COMPORTAMENTO


@pytest.fixture()
def cenario(client, fabrica, session):
    escola = fabrica.escola()
    aluno = fabrica.aluno(escola, fabrica.turma(escola))
    headers = fabrica.headers(fabrica.usuario(escola))

    class Cenario:
        dia = 0

        def lancar(self, peso, descricao="Registro"):
            """Grava direto no banco, um dia depois do anterior."""
            self.dia += 1
            r = RegistroDisciplinar(
                aluno_id=aluno.id,
                tipo=TipoRegistro.infracao if peso > 0 else TipoRegistro.merito,
                descricao=descricao,
                peso=peso,
                data_hora=datetime(2026, 11, 1) + timedelta(days=self.dia),
            )
            session.add(r)
            session.commit()
            return r.id

        def definir_pontos(self, pontos):
            a = session.get(Aluno, aluno.id)
            a.pontos_atuais = pontos
            session.add(a)
            session.commit()

        def merito_api(self, pontos):
            r = client.post(
                "/registros/merito", json={"aluno_id": aluno.id, "pontos_bonus": pontos}, headers=headers
            )
            assert r.status_code == 201, r.text
            return r.json()["registro"]["id"]

        def excluir(self, registro_id):
            assert client.delete(f"/registros/{registro_id}", headers=headers).status_code == 204
            session.expire_all()
            return session.get(Aluno, aluno.id).pontos_atuais

        def editar(self, registro_id, peso_novo, dia=1):
            regra = RegraInfracao(escola_id=escola.id, descricao="Regra nova", peso=peso_novo)
            session.add(regra)
            session.commit()
            r = client.put(
                f"/registros/{registro_id}",
                json={"regra_id": regra.id, "data_hora": f"2026-11-{dia + 1:02d}T00:00:00"},
                headers=headers,
            )
            assert r.status_code == 200, r.text
            session.expire_all()
            assert r.json()["pontos_atuais"] == session.get(Aluno, aluno.id).pontos_atuais
            return r.json()["pontos_atuais"]

    return Cenario()


def test_excluir_merito_de_aluno_zerado_mantem_zero(cenario):
    assert cenario.excluir(cenario.merito_api(50)) == 0


def test_excluir_merito_devolve_so_o_que_foi_descontado(cenario):
    cenario.lancar(3)
    merito = cenario.lancar(-50)
    cenario.definir_pontos(0)
    assert cenario.excluir(merito) == 3


def test_excluir_merito_descontado_por_inteiro(cenario):
    cenario.lancar(10)
    merito = cenario.lancar(-4)
    cenario.definir_pontos(6)
    assert cenario.excluir(merito) == 10


def test_excluir_indisciplina(cenario):
    infracao = cenario.lancar(5)
    cenario.lancar(3)
    cenario.definir_pontos(8)
    assert cenario.excluir(infracao) == 3


@pytest.mark.parametrize(
    "descricao", ["PONTO DE MÉRITO/BÔNUS (turma)", DESCRICAO_BONUS_BOM_COMPORTAMENTO]
)
def test_meritos_que_nao_mexem_em_pontos_nao_contam(cenario, descricao):
    cenario.lancar(5)
    merito = cenario.lancar(-100, descricao)
    cenario.lancar(2)
    cenario.definir_pontos(7)
    assert cenario.excluir(merito) == 7


def test_remocao_de_merito_da_turma_nao_vira_indisciplina(cenario):
    cenario.lancar(40, "REMOÇÃO DE MÉRITO (turma)")
    merito = cenario.lancar(-1)
    assert cenario.excluir(merito) == 0


def test_editar_indisciplina_ja_coberta_por_merito_mantem_zero(cenario):
    infracao = cenario.lancar(5)
    cenario.lancar(-10)
    assert cenario.editar(infracao, 8) == 0


def test_editar_indisciplina_troca_o_peso(cenario):
    infracao = cenario.lancar(5)
    cenario.lancar(3)
    cenario.definir_pontos(8)
    assert cenario.editar(infracao, 2) == 5


def test_editar_data_da_indisciplina_para_depois_do_merito(cenario):
    infracao = cenario.lancar(5)
    cenario.lancar(-10)
    assert cenario.editar(infracao, 5, dia=3) == 5
