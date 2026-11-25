from datetime import date, datetime

import pytest

from app.models.atividade import Atividade, TipoAtividade
from app.models.atribuicao import Atribuicao
from app.models.categoria_atividade import CategoriaAtividade
from app.models.configuracao_ranking import ConfiguracaoRanking
from app.models.disciplina import Disciplina
from app.models.lancamento import Lancamento
from app.models.professor import Professor
from app.models.registro_disciplinar import RegistroDisciplinar, TipoRegistro
from app.models.registro_falta import RegistroFalta
from app.models.usuario import PapelUsuario
from app.services.pontuacao import DESCRICAO_BONUS_BOM_COMPORTAMENTO, DESCRICAO_RECUPERACAO_AUTOMATICA


@pytest.fixture()
def cenario(client, fabrica, session):
    class Cenario:
        pass

    c = Cenario()
    c.escola = fabrica.escola()
    c.turma = fabrica.turma(c.escola)
    c.aluno = fabrica.aluno(c.escola, c.turma)
    usuario = fabrica.usuario(c.escola)
    c.headers = fabrica.headers(usuario)
    c.url = f"/ranking/extrato/{c.aluno.id}"
    escola_id, aluno_id, usuario_id = c.escola.id, c.aluno.id, usuario.id

    def salvar(obj):
        session.add(obj)
        session.commit()
        session.refresh(obj)
        return obj

    c.salvar = salvar
    salvar(ConfiguracaoRanking(escola_id=escola_id, peso_falta=0.5, peso_nao_entrega=0.25, nome_moeda="Veracoin"))
    c.professor = salvar(Professor(escola_id=escola_id, nome="Prof. Teste"))
    c.disciplina = salvar(Disciplina(escola_id=escola_id, nome="Matemática"))
    c.categoria = salvar(
        CategoriaAtividade(escola_id=escola_id, disciplina_id=c.disciplina.id, nome="Tarefas", peso=1)
    )
    prof_id, disc_id, cat_id = c.professor.id, c.disciplina.id, c.categoria.id

    def registro(tipo, descricao, peso, quando=datetime(2026, 11, 20, 15, 0), **extra):
        return salvar(
            RegistroDisciplinar(aluno_id=aluno_id, tipo=tipo, descricao=descricao, peso=peso, data_hora=quando, **extra)
        )

    c.registro = registro
    merito, infracao = TipoRegistro.merito, TipoRegistro.infracao
    registro(merito, "PONTO DE MÉRITO/BÔNUS", -100, professor_id=prof_id, observacao="Participação")
    registro(merito, "PONTO DE MÉRITO/BÔNUS (turma)", -10, registrado_por_usuario_id=usuario_id)
    registro(merito, "REMOÇÃO DE MÉRITO (turma)", 4, registrado_por_usuario_id=usuario_id)
    registro(merito, DESCRICAO_RECUPERACAO_AUTOMATICA, -2)
    registro(merito, DESCRICAO_BONUS_BOM_COMPORTAMENTO, -2)
    registro(infracao, "Conversa", 3, professor_id=prof_id)
    # 01:30 UTC do dia 18 ainda é dia 17 em Brasília.
    registro(infracao, "Atraso", 11, quando=datetime(2026, 11, 18, 1, 30))

    def falta(dia, justificada=False, disciplina=disc_id):
        salvar(
            RegistroFalta(
                aluno_id=aluno_id,
                escola_id=escola_id,
                disciplina_id=disciplina,
                data=date(2026, 11, dia),
                justificada=justificada,
                registrado_por_usuario_id=usuario_id,
            )
        )

    falta(3)
    falta(5, disciplina=None)
    falta(6, justificada=True)

    def atividade(titulo, ativo=True, fez=False, entrega=None):
        a = salvar(
            Atividade(
                escola_id=escola_id,
                disciplina_id=disc_id,
                turma="5A",
                titulo=titulo,
                tipo=TipoAtividade.atividade,
                categoria_id=cat_id,
                data=date(2026, 11, 1),
                data_entrega=entrega,
                ativo=ativo,
            )
        )
        salvar(Lancamento(atividade_id=a.id, aluno_id=aluno_id, fez=fez))

    atividade("Tarefa 1")
    atividade("Tarefa 2", entrega=date(2026, 11, 9))
    atividade("Tarefa 3")
    atividade("Entregue", fez=True)
    atividade("Cancelada", ativo=False)
    return c


def test_a_soma_dos_lancamentos_e_a_pontuacao_do_ranking(client, cenario):
    r = client.get(cenario.url, headers=cenario.headers)
    assert r.status_code == 200, r.text
    e = r.json()
    item = next(
        i for i in client.get("/ranking", headers=cenario.headers).json() if i["aluno_id"] == cenario.aluno.id
    )
    for campo, valor in item.items():
        assert e[campo] == valor

    def soma(lista):
        return sum(i["valor"] for i in e[lista])

    # 110 − 14 − 2 × 0,50 − 3 × 0,25
    assert e["pontuacao"] == 94.25
    assert soma("meritos") == e["total_merito"] == 110
    assert soma("ocorrencias") == -e["total_infracao"] == -14
    assert (len(e["faltas"]), soma("faltas")) == (e["faltas_nao_justificadas"], -1.0) == (2, -1.0)
    assert (len(e["nao_entregues"]), soma("nao_entregues")) == (e["atividades_nao_entregues"], -0.75) == (3, -0.75)
    assert sum(soma(x) for x in ("meritos", "ocorrencias", "faltas", "nao_entregues")) == e["pontuacao"]


def test_detalhes_dos_lancamentos(client, cenario):
    e = client.get(cenario.url, headers=cenario.headers).json()
    assert (e["nome_moeda"], e["peso_falta"], e["peso_nao_entrega"]) == ("Veracoin", 0.5, 0.25)
    assert e["escola_nome"] == cenario.escola.nome and e["matricula"] == cenario.aluno.matricula

    meritos = {m["descricao"]: m for m in e["meritos"]}
    assert len(meritos) == 5  # inclui turma, retirada, recuperação e bom comportamento
    individual = meritos["PONTO DE MÉRITO/BÔNUS"]
    assert (individual["professor_nome"], individual["observacao"], individual["valor"]) == (
        "Prof. Teste",
        "Participação",
        100,
    )
    assert meritos["REMOÇÃO DE MÉRITO (turma)"]["valor"] == -4
    assert meritos["PONTO DE MÉRITO/BÔNUS (turma)"]["professor_nome"] == "Teste"
    assert meritos[DESCRICAO_RECUPERACAO_AUTOMATICA]["professor_nome"] is None

    assert [(o["descricao"], o["data"], o["valor"]) for o in e["ocorrencias"]] == [
        ("Conversa", "2026-11-20", -3),
        ("Atraso", "2026-11-17", -11),
    ]
    assert [(f["descricao"], f["data"]) for f in e["faltas"]] == [
        ("Falta do dia", "2026-11-05"),
        ("Matemática", "2026-11-03"),
    ]
    assert e["nao_entregues"][0]["descricao"] == "Tarefa 2 (Matemática)"
    assert e["nao_entregues"][0]["data"] == "2026-11-09"


def test_aluno_sem_lancamentos_e_sem_configuracao(client, fabrica):
    escola = fabrica.escola()
    aluno = fabrica.aluno(escola, fabrica.turma(escola))
    e = client.get(f"/ranking/extrato/{aluno.id}", headers=fabrica.headers(fabrica.usuario(escola))).json()
    assert e["pontuacao"] == 0 and e["peso_falta"] == 1
    assert e["meritos"] == e["ocorrencias"] == e["faltas"] == e["nao_entregues"] == []


def test_acesso_ao_extrato(client, cenario, fabrica):
    usuario = fabrica.usuario(cenario.escola, papel=PapelUsuario.professor)
    h = fabrica.headers(usuario)
    assert client.get(cenario.url, headers=h).status_code == 403
    escola_id, turma = cenario.escola.id, cenario.turma.nome
    prof = cenario.salvar(Professor(escola_id=escola_id, nome="Outro", usuario_id=usuario.id))
    cenario.salvar(
        Atribuicao(escola_id=escola_id, professor_id=prof.id, disciplina_id=cenario.disciplina.id, turma=turma)
    )
    assert client.get(cenario.url, headers=h).status_code == 200

    h_outra = fabrica.headers(fabrica.usuario(fabrica.escola()))
    assert client.get(cenario.url, headers=h_outra).status_code == 404
    assert client.get(cenario.url).status_code == 401
