import threading
import uuid
from datetime import timedelta

from sqlmodel import select

from app.models.atribuicao import Atribuicao
from app.models.disciplina import Disciplina
from app.models.feirinha import CartaoAluno, TransacaoVeracoin
from app.models.professor import Professor
from app.models.registro_disciplinar import RegistroDisciplinar
from app.models.usuario import PapelUsuario


def _chave():
    return str(uuid.uuid4())


def _preparar(client, fabrica, veracoins=10, papel=PapelUsuario.admin_escola):
    escola = fabrica.escola()
    turma = fabrica.turma(escola)
    usuario = fabrica.usuario(escola, papel=papel)
    aluno = fabrica.aluno(escola, turma, veracoins=veracoins)
    h = fabrica.headers(usuario)
    h_admin = fabrica.headers(fabrica.usuario(escola))
    r = client.post(f"/cartoes/gerar?turma_id={turma.id}", headers=h_admin)
    assert r.status_code == 200, r.text
    dados = client.get(f"/cartoes/imprimir?turma_id={turma.id}", headers=h_admin).json()
    token = dados["cartoes"][0]["token"]
    return escola, turma, usuario, aluno, h, token


def _debitar(client, h, token, valor, chave=None, descricao=None):
    return client.post(
        "/feirinha/debito",
        json={"token": token, "valor": valor, "chave_idempotencia": chave or _chave(), "descricao": descricao},
        headers=h,
    )


def test_qr_e_saldo_igual_ao_patrimonio(client, fabrica):
    _, _, _, aluno, h, token = _preparar(client, fabrica, veracoins=12)

    r = client.get(f"/feirinha/cartao/VERACOIN:{token}", headers=h)
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["aluno_id"] == aluno.id
    assert corpo["saldo"] == 12
    assert corpo["foto_url"] is None

    ranking = {i["aluno_id"]: i for i in client.get("/ranking", headers=h).json()}
    assert ranking[aluno.id]["pontuacao"] == corpo["patrimonio"] == 12


def test_debito_normal_nao_altera_ranking(client, fabrica, session):
    _, _, _, aluno, h, token = _preparar(client, fabrica, veracoins=10)
    registros_antes = session.exec(select(RegistroDisciplinar).where(RegistroDisciplinar.aluno_id == aluno.id)).all()

    r = _debitar(client, h, token, 4, descricao="Pipoca")
    assert r.status_code == 200, r.text
    assert r.json()["saldo"] == 6
    assert client.get(f"/feirinha/cartao/{token}", headers=h).json()["saldo"] == 6

    # Patrimônio Disciplinar e registros continuam iguais.
    ranking = {i["aluno_id"]: i for i in client.get("/ranking", headers=h).json()}
    assert ranking[aluno.id]["pontuacao"] == 10
    registros_depois = session.exec(select(RegistroDisciplinar).where(RegistroDisciplinar.aluno_id == aluno.id)).all()
    assert len(registros_depois) == len(registros_antes)


def test_saldo_insuficiente_e_valor_invalido(client, fabrica):
    _, _, _, _, h, token = _preparar(client, fabrica, veracoins=5)

    r = _debitar(client, h, token, 6)
    assert r.status_code == 409
    assert r.json()["saldo"] == 5

    assert _debitar(client, h, token, 0).status_code == 400
    assert _debitar(client, h, token, -3).status_code == 400
    assert client.get(f"/feirinha/cartao/{token}", headers=h).json()["saldo"] == 5


def test_debitos_simultaneos_nunca_deixam_saldo_negativo(client, fabrica, session):
    _, _, _, aluno, h, token = _preparar(client, fabrica, veracoins=10)
    resultados = []
    barreira = threading.Barrier(6)

    def comprar():
        barreira.wait()
        resultados.append(_debitar(client, h, token, 4).status_code)

    threads = [threading.Thread(target=comprar) for _ in range(6)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sorted(resultados) == [200, 200, 409, 409, 409, 409]
    assert client.get(f"/feirinha/cartao/{token}", headers=h).json()["saldo"] == 2
    debitos = session.exec(select(TransacaoVeracoin).where(TransacaoVeracoin.aluno_id == aluno.id)).all()
    assert sum(d.valor for d in debitos) == 8


def test_idempotencia(client, fabrica, session):
    _, _, _, aluno, h, token = _preparar(client, fabrica, veracoins=10)
    chave = _chave()

    r1 = _debitar(client, h, token, 3, chave=chave)
    r2 = _debitar(client, h, token, 3, chave=chave)
    assert r1.status_code == r2.status_code == 200
    assert r1.json()["transacao_id"] == r2.json()["transacao_id"]
    assert r2.json()["repetida"] is True
    assert r2.json()["saldo"] == 7
    assert len(session.exec(select(TransacaoVeracoin).where(TransacaoVeracoin.aluno_id == aluno.id)).all()) == 1


def test_reemissao_desativa_token_antigo(client, fabrica):
    _, turma, _, aluno, h, token_antigo = _preparar(client, fabrica, veracoins=10)

    r = client.post(f"/cartoes/{aluno.id}/reemitir", headers=h)
    assert r.status_code == 200, r.text

    assert client.get(f"/feirinha/cartao/{token_antigo}", headers=h).status_code == 404
    assert _debitar(client, h, token_antigo, 1).status_code == 404

    novo = client.get(f"/cartoes/imprimir?turma_id={turma.id}&aluno_id={aluno.id}", headers=h).json()["cartoes"]
    assert len(novo) == 1 and novo[0]["token"] != token_antigo
    assert client.get(f"/feirinha/cartao/{novo[0]['token']}", headers=h).json()["saldo"] == 10

    # Gerar de novo não duplica: aluno já tem cartão ativo.
    r = client.post(f"/cartoes/gerar?turma_id={turma.id}", headers=h).json()
    assert r == {"gerados": 0, "ja_tinham": 1}


def test_isolamento_entre_escolas(client, fabrica):
    _, turma_a, _, aluno_a, h_a, token_a = _preparar(client, fabrica, veracoins=10)
    _, _, _, _, h_b, _ = _preparar(client, fabrica, veracoins=10)

    assert client.get(f"/feirinha/cartao/{token_a}", headers=h_b).status_code == 403
    assert _debitar(client, h_b, token_a, 1).status_code == 403
    assert client.get(f"/cartoes/imprimir?turma_id={turma_a.id}", headers=h_b).status_code == 404
    assert client.post(f"/cartoes/{aluno_a.id}/reemitir", headers=h_b).status_code == 404

    venda = _debitar(client, h_a, token_a, 2).json()
    assert client.post(f"/feirinha/estorno/{venda['transacao_id']}", headers=h_b).status_code == 404
    assert client.get("/feirinha/resumo", headers=h_b).json()["total_geral"] == 0


def test_qr_sem_prefixo_errado_e_token_inexistente(client, fabrica):
    _, _, _, _, h, _ = _preparar(client, fabrica)
    assert client.get("/feirinha/cartao/naoexiste123", headers=h).status_code == 404


def test_estorno(client, fabrica, session):
    escola, _, professor, aluno, h_prof, token = _preparar(
        client, fabrica, veracoins=10, papel=PapelUsuario.professor
    )
    # Professor sem atribuição de turma ainda pode usar o caixa.
    venda = _debitar(client, h_prof, token, 6)
    assert venda.status_code == 200, venda.text
    tid = venda.json()["transacao_id"]

    # Outro professor não pode desfazer a venda.
    outro = fabrica.headers(fabrica.usuario(escola, papel=PapelUsuario.professor))
    assert client.post(f"/feirinha/estorno/{tid}", headers=outro).status_code == 403

    r = client.post(f"/feirinha/estorno/{tid}", headers=h_prof)
    assert r.status_code == 200, r.text
    assert r.json()["saldo"] == 10
    assert client.post(f"/feirinha/estorno/{tid}", headers=h_prof).status_code == 409

    # O débito original continua gravado (nunca apagado).
    assert session.get(TransacaoVeracoin, tid) is not None
    vendas = client.get("/feirinha/vendas-recentes", headers=h_prof).json()
    assert vendas[0]["transacao_id"] == tid and vendas[0]["estornado"] is True

    resumo = client.get("/feirinha/resumo", headers=h_prof).json()
    assert resumo["total_geral"] == 0 and resumo["estornadas"] == 1


def test_estorno_fora_do_prazo_so_gestao(client, fabrica, session):
    escola, _, _, _, h_prof, token = _preparar(client, fabrica, veracoins=10, papel=PapelUsuario.professor)
    tid = _debitar(client, h_prof, token, 3).json()["transacao_id"]

    debito = session.get(TransacaoVeracoin, tid)
    debito.criado_em = debito.criado_em - timedelta(minutes=11)
    session.add(debito)
    session.commit()

    assert client.post(f"/feirinha/estorno/{tid}", headers=h_prof).status_code == 403
    admin = fabrica.headers(fabrica.usuario(escola, papel=PapelUsuario.admin_escola))
    assert client.post(f"/feirinha/estorno/{tid}", headers=admin).status_code == 200


def test_resumo_por_turma_e_aluno(client, fabrica):
    escola, turma, _, aluno, h, token = _preparar(client, fabrica, veracoins=20)
    _debitar(client, h, token, 3)
    _debitar(client, h, token, 5)

    resumo = client.get("/feirinha/resumo", headers=h).json()
    assert resumo["total_geral"] == 8 and resumo["compras"] == 2
    assert resumo["por_turma"] == [{"turma": turma.nome, "compras": 2, "total": 8}]
    assert resumo["por_aluno"][0]["aluno_id"] == aluno.id


def test_numeracao_sequencial_e_um_ativo_por_aluno(client, fabrica, session):
    escola = fabrica.escola()
    turma = fabrica.turma(escola)
    h = fabrica.headers(fabrica.usuario(escola))
    for _ in range(3):
        fabrica.aluno(escola, turma)
    assert client.post(f"/cartoes/gerar?turma_id={turma.id}", headers=h).json()["gerados"] == 3
    numeros = sorted(c["numero"] for c in client.get(f"/cartoes/imprimir?turma_id={turma.id}", headers=h).json()["cartoes"])
    assert numeros == [1, 2, 3]
    ativos = session.exec(select(CartaoAluno).where(CartaoAluno.escola_id == escola.id, CartaoAluno.ativo == True)).all()  # noqa: E712
    assert len({c.aluno_id for c in ativos}) == len(ativos) == 3


def test_busca_manual_pelo_numero_do_cartao(client, fabrica):
    _, _, _, aluno, h, token = _preparar(client, fabrica, veracoins=7)
    numero = client.get(f"/feirinha/cartao/{token}", headers=h).json()["numero"]
    r = client.get(f"/feirinha/cartao/{numero}", headers=h)
    assert r.status_code == 200 and r.json()["aluno_id"] == aluno.id and r.json()["token"] == token
    # Número de cartão de outra escola não é encontrado.
    _, _, _, _, h_b, _ = _preparar(client, fabrica)
    assert client.get(f"/feirinha/cartao/99999", headers=h_b).status_code == 404


def test_extrato_e_busca_por_nome(client, fabrica):
    escola, turma, _, aluno, h, token = _preparar(client, fabrica, veracoins=45)
    _debitar(client, h, token, 5, descricao="Pipoca")
    _debitar(client, h, token, 8, descricao="Caderno")
    desfeita = _debitar(client, h, token, 5, descricao="Bala").json()["transacao_id"]
    client.post(f"/feirinha/estorno/{desfeita}", headers=h)

    ext = client.get(f"/feirinha/extrato/{aluno.id}", headers=h).json()
    assert (ext["acumulado"], ext["gasto"], ext["saldo"]) == (45, 13, 32)
    assert [c["descricao"] for c in ext["compras"]] == ["Bala", "Caderno", "Pipoca"]
    assert [c["estornado"] for c in ext["compras"]] == [True, False, False]
    assert ext["compras"][0]["operador_nome"] == "Teste"

    achados = client.get(f"/feirinha/alunos?busca={aluno.nome[:6].lower()}", headers=h).json()
    assert any(a["aluno_id"] == aluno.id for a in achados)

    # Outra escola não vê o extrato nem encontra o aluno.
    _, _, _, _, h_b, _ = _preparar(client, fabrica)
    assert client.get(f"/feirinha/extrato/{aluno.id}", headers=h_b).status_code == 404
    assert all(a["aluno_id"] != aluno.id for a in client.get(f"/feirinha/alunos?busca={aluno.nome}", headers=h_b).json())


def test_extrato_da_turma_igual_ao_individual(client, fabrica, session):
    escola, turma, _, aluno, h, token = _preparar(client, fabrica, veracoins=45)
    sem_compras = fabrica.aluno(escola, turma, veracoins=7)
    negativo = fabrica.aluno(escola, turma)
    session.add(RegistroDisciplinar(aluno_id=negativo.id, tipo="infracao", descricao="Regra", peso=4))
    session.commit()
    fabrica.aluno(escola, fabrica.turma(escola, "1B"), veracoins=99)
    _debitar(client, h, token, 5, descricao="Pipoca")
    _debitar(client, h, token, 8)
    desfeita = _debitar(client, h, token, 6).json()["transacao_id"]
    client.post(f"/feirinha/estorno/{desfeita}", headers=h)

    r = client.get(f"/feirinha/extrato-turma?turma_id={turma.id}", headers=h)
    assert r.status_code == 200, r.text
    corpo = r.json()
    assert (corpo["escola_nome"], corpo["turma"]) == (escola.nome, "5A")
    por_id = {a["aluno_id"]: a for a in corpo["alunos"]}
    assert set(por_id) == {aluno.id, sem_compras.id, negativo.id}  # só a turma pedida

    totais = {i: (a["acumulado"], a["gasto"], a["saldo"], len(a["compras"])) for i, a in por_id.items()}
    assert totais[aluno.id] == (45, 13, 32, 3)
    assert totais[sem_compras.id] == (7, 0, 7, 0)
    assert totais[negativo.id] == (-4, 0, 0, 0)
    for aluno_id, linha in por_id.items():
        assert client.get(f"/feirinha/extrato/{aluno_id}", headers=h).json() == linha


def test_extrato_da_turma_respeita_acesso(client, fabrica, session):
    escola, turma, _, _, _, _ = _preparar(client, fabrica)
    outra_turma = fabrica.turma(escola, "1B")
    usuario = fabrica.usuario(escola, papel=PapelUsuario.professor)
    h = fabrica.headers(usuario)
    url = "/feirinha/extrato-turma?turma_id="
    assert client.get(f"{url}{turma.id}", headers=h).status_code == 403

    professor = Professor(escola_id=escola.id, nome="Prof", usuario_id=usuario.id)
    disciplina = Disciplina(escola_id=escola.id, nome="Matemática")
    session.add_all([professor, disciplina])
    session.commit()
    session.add(
        Atribuicao(escola_id=escola.id, professor_id=professor.id, disciplina_id=disciplina.id, turma=turma.nome)
    )
    session.commit()
    assert client.get(f"{url}{turma.id}", headers=h).status_code == 200
    assert client.get(f"{url}{outra_turma.id}", headers=h).status_code == 403

    h_coord = fabrica.headers(fabrica.usuario(escola, papel=PapelUsuario.coordenacao))
    assert client.get(f"{url}{outra_turma.id}", headers=h_coord).json()["alunos"] == []
    h_outra_escola = fabrica.headers(fabrica.usuario(fabrica.escola()))
    assert client.get(f"{url}{turma.id}", headers=h_outra_escola).status_code == 404
    assert client.get(f"{url}{turma.id}").status_code == 401
