"""Cartão com QR + Caixa da Feirinha.

Saldo do aluno = valor do Patrimônio Disciplinar (mesmo cálculo da tela de
Ranking, arredondado para baixo) − débitos + estornos da feirinha. Nada
daqui altera pontos, méritos ou registros disciplinares.
"""

import math
import secrets
from datetime import date, datetime, time, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, select

from app.api.deps import CurrentUserDep, SessionDep, require_roles
from app.api.routes.ranking import _montar_ranking
from app.core.ano_letivo import ano_letivo_atual
from app.core.permissoes import PAPEIS_ACESSO_TOTAL, verificar_permissao_turma
from app.core.tempo import FUSO_BRASIL, agora_utc
from app.models.aluno import Aluno
from app.models.escola import Escola
from app.models.feirinha import CartaoAluno, TipoTransacaoVeracoin, TransacaoVeracoin
from app.models.turma import Turma
from app.models.usuario import PapelUsuario, Usuario
from app.schemas.feirinha import (
    AlunoBusca,
    CompraExtrato,
    ExtratoAluno,
    CartaoFeirinha,
    CartaoImpressao,
    CartaoStatusAluno,
    DebitoCreate,
    GerarCartoesResultado,
    ImpressaoCartoes,
    ResumoAluno,
    ResumoFeirinha,
    ResumoTurma,
    TransacaoResultado,
    VendaRecente,
)

PREFIXO_QR = "VERACOIN:"
PRAZO_DESFAZER = timedelta(minutes=10)

PodeUsarFeirinha = Depends(
    require_roles(PapelUsuario.admin_escola, PapelUsuario.coordenacao, PapelUsuario.professor)
)

router = APIRouter(tags=["feirinha"], dependencies=[PodeUsarFeirinha])


# ---------------------------------------------------------------- utilidades


def _novo_token() -> str:
    return secrets.token_urlsafe(16)


def _normalizar_token(token: str) -> str:
    """Aceita o token puro ou o conteúdo completo do QR (`VERACOIN:<token>`)."""
    token = token.strip()
    if token.upper().startswith(PREFIXO_QR):
        token = token[len(PREFIXO_QR):]
    return token


def _turma_da_escola(session: Session, turma_id: int, usuario: Usuario) -> Turma:
    turma = session.get(Turma, turma_id)
    if turma is None or turma.escola_id != usuario.escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Turma não encontrada.")
    verificar_permissao_turma(session, usuario, turma.nome)
    return turma


def _alunos_da_turma(session: Session, escola_id: int, turma_nome: str) -> list[Aluno]:
    alunos = session.exec(
        select(Aluno).where(Aluno.escola_id == escola_id, Aluno.turma == turma_nome)
    ).all()
    return sorted(alunos, key=lambda a: (a.numero_chamada is None, a.numero_chamada or 0, a.nome.lower()))


def _proximo_numero(session: Session, escola_id: int) -> int:
    maior = session.exec(select(func.max(CartaoAluno.numero)).where(CartaoAluno.escola_id == escola_id)).one()
    return (maior or 0) + 1


def _travar_escola(session: Session, escola_id: int) -> None:
    """Serializa a numeração dos cartões da escola (evita dois números iguais
    se duas pessoas gerarem cartões ao mesmo tempo)."""
    session.exec(select(Escola).where(Escola.id == escola_id).with_for_update()).one()


def _cartao_ativo_por_token(session: Session, token: str, usuario: Usuario) -> CartaoAluno:
    """Aceita o conteúdo do QR, o token puro ou — digitação manual no caixa —
    o número impresso no cartão (só dígitos; tokens nunca são só dígitos)."""
    token = _normalizar_token(token)
    if token.isdigit() and len(token) <= 9:
        cartao = session.exec(
            select(CartaoAluno).where(
                CartaoAluno.escola_id == usuario.escola_id,
                CartaoAluno.numero == int(token),
                CartaoAluno.ativo == True,  # noqa: E712
            )
        ).first()
    else:
        cartao = session.exec(select(CartaoAluno).where(CartaoAluno.token == token)).first()
    if cartao is None or not cartao.ativo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cartão inválido ou desativado.")
    if cartao.escola_id != usuario.escola_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Este cartão é de outra escola.")
    return cartao


def patrimonio_do_aluno(session: Session, escola_id: int, aluno_id: int) -> float:
    """Mesmo valor mostrado no Patrimônio Disciplinar (reaproveita o cálculo do ranking)."""
    for item in _montar_ranking(session, escola_id):
        if item.aluno_id == aluno_id:
            return item.pontuacao
    return 0.0


def gasto_liquido_do_aluno(session: Session, aluno_id: int) -> int:
    linhas = session.exec(
        select(TransacaoVeracoin.tipo, func.coalesce(func.sum(TransacaoVeracoin.valor), 0))
        .where(TransacaoVeracoin.aluno_id == aluno_id)
        .group_by(TransacaoVeracoin.tipo)
    ).all()
    somas = {tipo: int(total) for tipo, total in linhas}
    return somas.get(TipoTransacaoVeracoin.debito.value, 0) - somas.get(TipoTransacaoVeracoin.estorno.value, 0)


def calcular_saldo(session: Session, escola_id: int, aluno_id: int) -> tuple[float, int, int]:
    """Retorna (patrimônio, gasto líquido, saldo disponível >= 0)."""
    patrimonio = patrimonio_do_aluno(session, escola_id, aluno_id)
    gasto = gasto_liquido_do_aluno(session, aluno_id)
    # +1e-9: a pontuação vem arredondada em 2 casas; evita 9.999999 virar 9.
    saldo = math.floor(patrimonio + 1e-9) - gasto
    return patrimonio, gasto, max(saldo, 0)


def _resultado(session: Session, transacao: TransacaoVeracoin, repetida: bool = False) -> TransacaoResultado:
    aluno = session.get(Aluno, transacao.aluno_id)
    _, _, saldo = calcular_saldo(session, transacao.escola_id, transacao.aluno_id)
    return TransacaoResultado(
        transacao_id=transacao.id,
        aluno_id=transacao.aluno_id,
        aluno_nome=aluno.nome if aluno else "",
        valor=transacao.valor,
        saldo=saldo,
        repetida=repetida,
    )


def _transacao_por_chave(session: Session, chave: str) -> Optional[TransacaoVeracoin]:
    return session.exec(select(TransacaoVeracoin).where(TransacaoVeracoin.chave_idempotencia == chave)).first()


# ------------------------------------------------------------------- cartões


@router.get("/cartoes", response_model=list[CartaoStatusAluno])
def listar_cartoes_da_turma(turma_id: int, session: SessionDep, usuario_atual: CurrentUserDep):
    turma = _turma_da_escola(session, turma_id, usuario_atual)
    alunos = _alunos_da_turma(session, usuario_atual.escola_id, turma.nome)
    ativos = {
        c.aluno_id: c
        for c in session.exec(
            select(CartaoAluno).where(
                CartaoAluno.escola_id == usuario_atual.escola_id,
                CartaoAluno.aluno_id.in_([a.id for a in alunos] or [0]),
                CartaoAluno.ativo == True,  # noqa: E712
            )
        ).all()
    }
    return [
        CartaoStatusAluno(
            aluno_id=a.id,
            aluno_nome=a.nome,
            numero_chamada=a.numero_chamada,
            cartao_id=ativos[a.id].id if a.id in ativos else None,
            numero=ativos[a.id].numero if a.id in ativos else None,
            criado_em=ativos[a.id].criado_em if a.id in ativos else None,
        )
        for a in alunos
    ]


@router.post("/cartoes/gerar", response_model=GerarCartoesResultado)
def gerar_cartoes(turma_id: int, session: SessionDep, usuario_atual: CurrentUserDep):
    turma = _turma_da_escola(session, turma_id, usuario_atual)
    escola_id = usuario_atual.escola_id
    _travar_escola(session, escola_id)

    alunos = _alunos_da_turma(session, escola_id, turma.nome)
    com_cartao = set(
        session.exec(
            select(CartaoAluno.aluno_id).where(
                CartaoAluno.escola_id == escola_id,
                CartaoAluno.aluno_id.in_([a.id for a in alunos] or [0]),
                CartaoAluno.ativo == True,  # noqa: E712
            )
        ).all()
    )

    numero = _proximo_numero(session, escola_id)
    gerados = 0
    for aluno in alunos:
        if aluno.id in com_cartao:
            continue
        session.add(CartaoAluno(escola_id=escola_id, aluno_id=aluno.id, token=_novo_token(), numero=numero))
        numero += 1
        gerados += 1
    session.commit()
    return GerarCartoesResultado(gerados=gerados, ja_tinham=len(com_cartao))


@router.post("/cartoes/{aluno_id}/reemitir", response_model=CartaoStatusAluno)
def reemitir_cartao(aluno_id: int, session: SessionDep, usuario_atual: CurrentUserDep):
    escola_id = usuario_atual.escola_id
    aluno = session.get(Aluno, aluno_id)
    if aluno is None or aluno.escola_id != escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aluno não encontrado.")
    verificar_permissao_turma(session, usuario_atual, aluno.turma)

    _travar_escola(session, escola_id)
    agora = agora_utc()
    for antigo in session.exec(
        select(CartaoAluno).where(CartaoAluno.aluno_id == aluno_id, CartaoAluno.ativo == True)  # noqa: E712
    ).all():
        antigo.ativo = False
        antigo.desativado_em = agora
        session.add(antigo)
    session.flush()

    novo = CartaoAluno(
        escola_id=escola_id, aluno_id=aluno_id, token=_novo_token(), numero=_proximo_numero(session, escola_id)
    )
    session.add(novo)
    session.commit()
    session.refresh(novo)
    return CartaoStatusAluno(
        aluno_id=aluno.id,
        aluno_nome=aluno.nome,
        numero_chamada=aluno.numero_chamada,
        cartao_id=novo.id,
        numero=novo.numero,
        criado_em=novo.criado_em,
    )


@router.get("/cartoes/imprimir", response_model=ImpressaoCartoes)
def dados_impressao(
    turma_id: int,
    session: SessionDep,
    usuario_atual: CurrentUserDep,
    aluno_id: Optional[int] = None,
):
    """Cartões ativos da turma para a página de impressão. Com `aluno_id`,
    só o cartão daquele aluno (útil depois de uma reemissão)."""
    turma = _turma_da_escola(session, turma_id, usuario_atual)
    escola = session.get(Escola, usuario_atual.escola_id)
    alunos = _alunos_da_turma(session, usuario_atual.escola_id, turma.nome)
    if aluno_id is not None:
        alunos = [a for a in alunos if a.id == aluno_id]
    ativos = {
        c.aluno_id: c
        for c in session.exec(
            select(CartaoAluno).where(
                CartaoAluno.escola_id == usuario_atual.escola_id,
                CartaoAluno.aluno_id.in_([a.id for a in alunos] or [0]),
                CartaoAluno.ativo == True,  # noqa: E712
            )
        ).all()
    }
    ano = ano_letivo_atual(session, usuario_atual.escola_id)
    return ImpressaoCartoes(
        escola_nome=escola.nome if escola else "",
        ano=ano.ano if ano else date.today().year,
        turma=turma.nome,
        cartoes=[
            CartaoImpressao(aluno_id=a.id, aluno_nome=a.nome, numero=ativos[a.id].numero, token=ativos[a.id].token)
            for a in alunos
            if a.id in ativos
        ],
    )


# ------------------------------------------------------------------ feirinha


@router.get("/feirinha/cartao/{token}", response_model=CartaoFeirinha)
def consultar_cartao(token: str, session: SessionDep, usuario_atual: CurrentUserDep):
    cartao = _cartao_ativo_por_token(session, token, usuario_atual)
    aluno = session.get(Aluno, cartao.aluno_id)
    patrimonio, gasto, saldo = calcular_saldo(session, cartao.escola_id, cartao.aluno_id)
    return CartaoFeirinha(
        aluno_id=aluno.id,
        nome=aluno.nome,
        turma=aluno.turma,
        foto_url=None,
        numero=cartao.numero,
        token=cartao.token,
        patrimonio=patrimonio,
        gasto=gasto,
        saldo=saldo,
    )


@router.post("/feirinha/debito", response_model=TransacaoResultado)
def debitar(dados: DebitoCreate, session: SessionDep, usuario_atual: CurrentUserDep):
    # Idempotência: mesma chave = mesma compra (toque duplo, reenvio por falha de rede).
    anterior = _transacao_por_chave(session, dados.chave_idempotencia)
    if anterior is not None:
        if anterior.escola_id != usuario_atual.escola_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Chave de operação já usada.")
        return _resultado(session, anterior, repetida=True)

    if dados.valor <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="O valor deve ser maior que zero.")

    cartao = _cartao_ativo_por_token(session, dados.token, usuario_atual)

    # Trava o aluno até o fim da transação: dois caixas debitando o mesmo
    # aluno ao mesmo tempo ficam em fila, e o segundo já vê o saldo novo.
    session.exec(select(Aluno).where(Aluno.id == cartao.aluno_id).with_for_update()).one()

    # Outra requisição com a mesma chave pode ter terminado enquanto esperávamos a trava.
    anterior = _transacao_por_chave(session, dados.chave_idempotencia)
    if anterior is not None:
        session.commit()
        return _resultado(session, anterior, repetida=True)

    _, _, saldo = calcular_saldo(session, cartao.escola_id, cartao.aluno_id)
    if dados.valor > saldo:
        session.rollback()
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": f"Saldo insuficiente. Saldo atual: {saldo}.", "saldo": saldo},
        )

    transacao = TransacaoVeracoin(
        escola_id=cartao.escola_id,
        aluno_id=cartao.aluno_id,
        cartao_id=cartao.id,
        tipo=TipoTransacaoVeracoin.debito,
        valor=dados.valor,
        descricao=(dados.descricao or "").strip() or None,
        operador_id=usuario_atual.id,
        origem="feirinha",
        chave_idempotencia=dados.chave_idempotencia,
    )
    session.add(transacao)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        anterior = _transacao_por_chave(session, dados.chave_idempotencia)
        if anterior is None:
            raise
        return _resultado(session, anterior, repetida=True)
    session.refresh(transacao)
    return _resultado(session, transacao)


@router.post("/feirinha/estorno/{transacao_id}", response_model=TransacaoResultado)
def estornar(transacao_id: int, session: SessionDep, usuario_atual: CurrentUserDep):
    debito = session.get(TransacaoVeracoin, transacao_id)
    if (
        debito is None
        or debito.escola_id != usuario_atual.escola_id
        or debito.tipo != TipoTransacaoVeracoin.debito
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venda não encontrada.")

    eh_gestao = usuario_atual.papel in PAPEIS_ACESSO_TOTAL
    dentro_do_prazo = agora_utc() - debito.criado_em <= PRAZO_DESFAZER
    if not eh_gestao and not (debito.operador_id == usuario_atual.id and dentro_do_prazo):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Só quem fez a venda pode desfazer, em até 10 minutos. Depois disso, peça à coordenação.",
        )

    session.exec(select(Aluno).where(Aluno.id == debito.aluno_id).with_for_update()).one()
    estorno = TransacaoVeracoin(
        escola_id=debito.escola_id,
        aluno_id=debito.aluno_id,
        cartao_id=debito.cartao_id,
        tipo=TipoTransacaoVeracoin.estorno,
        valor=debito.valor,
        descricao=f"Estorno da venda #{debito.id}",
        operador_id=usuario_atual.id,
        origem="feirinha",
        estorno_de_id=debito.id,
    )
    session.add(estorno)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Esta venda já foi desfeita.")
    session.refresh(estorno)
    return _resultado(session, estorno)


@router.get("/feirinha/vendas-recentes", response_model=list[VendaRecente])
def vendas_recentes(session: SessionDep, usuario_atual: CurrentUserDep, limite: int = 5):
    """Últimas vendas feitas por quem está logado (lista do caixa)."""
    limite = max(1, min(limite, 50))
    debitos = session.exec(
        select(TransacaoVeracoin)
        .where(
            TransacaoVeracoin.escola_id == usuario_atual.escola_id,
            TransacaoVeracoin.operador_id == usuario_atual.id,
            TransacaoVeracoin.tipo == TipoTransacaoVeracoin.debito,
        )
        .order_by(TransacaoVeracoin.criado_em.desc(), TransacaoVeracoin.id.desc())
        .limit(limite)
    ).all()
    estornados = set(
        session.exec(
            select(TransacaoVeracoin.estorno_de_id).where(
                TransacaoVeracoin.estorno_de_id.in_([d.id for d in debitos] or [0])
            )
        ).all()
    )
    agora = agora_utc()
    eh_gestao = usuario_atual.papel in PAPEIS_ACESSO_TOTAL
    resultado = []
    for d in debitos:
        aluno = session.get(Aluno, d.aluno_id)
        estornado = d.id in estornados
        resultado.append(
            VendaRecente(
                transacao_id=d.id,
                aluno_nome=aluno.nome if aluno else "",
                turma=aluno.turma if aluno else None,
                valor=d.valor,
                descricao=d.descricao,
                criado_em=d.criado_em,
                estornado=estornado,
                pode_desfazer=not estornado and (eh_gestao or agora - d.criado_em <= PRAZO_DESFAZER),
            )
        )
    return resultado


@router.get("/feirinha/resumo", response_model=ResumoFeirinha)
def resumo(session: SessionDep, usuario_atual: CurrentUserDep, data: Optional[date] = None):
    """Total vendido no dia (horário de Brasília), por turma e por aluno.
    Vendas desfeitas não entram no total."""
    if data is None:
        data = datetime.now(FUSO_BRASIL).date()
    # Meia-noite em Brasília convertida para UTC (formato gravado no banco).
    inicio_utc = datetime.combine(data, time.min) - FUSO_BRASIL.utcoffset(None)
    fim_utc = inicio_utc + timedelta(days=1)

    debitos = session.exec(
        select(TransacaoVeracoin).where(
            TransacaoVeracoin.escola_id == usuario_atual.escola_id,
            TransacaoVeracoin.tipo == TipoTransacaoVeracoin.debito,
            TransacaoVeracoin.criado_em >= inicio_utc,
            TransacaoVeracoin.criado_em < fim_utc,
        )
    ).all()
    estornados = set(
        session.exec(
            select(TransacaoVeracoin.estorno_de_id).where(
                TransacaoVeracoin.estorno_de_id.in_([d.id for d in debitos] or [0])
            )
        ).all()
    )

    por_aluno: dict[int, ResumoAluno] = {}
    for d in debitos:
        if d.id in estornados:
            continue
        if d.aluno_id not in por_aluno:
            aluno = session.get(Aluno, d.aluno_id)
            por_aluno[d.aluno_id] = ResumoAluno(
                aluno_id=d.aluno_id, aluno_nome=aluno.nome, turma=aluno.turma, compras=0, total=0
            )
        por_aluno[d.aluno_id].compras += 1
        por_aluno[d.aluno_id].total += d.valor

    por_turma: dict[Optional[str], ResumoTurma] = {}
    for item in por_aluno.values():
        t = por_turma.setdefault(item.turma, ResumoTurma(turma=item.turma, compras=0, total=0))
        t.compras += item.compras
        t.total += item.total

    return ResumoFeirinha(
        data=data.isoformat(),
        total_geral=sum(i.total for i in por_aluno.values()),
        compras=sum(i.compras for i in por_aluno.values()),
        estornadas=len(estornados),
        por_turma=sorted(por_turma.values(), key=lambda t: t.turma or ""),
        por_aluno=sorted(por_aluno.values(), key=lambda a: ((a.turma or ""), a.aluno_nome.lower())),
    )


@router.get("/feirinha/alunos", response_model=list[AlunoBusca])
def buscar_alunos(busca: str, session: SessionDep, usuario_atual: CurrentUserDep):
    """Busca por nome para a Consulta de Saldo (quando o aluno está sem o cartão)."""
    termo = busca.strip()
    if len(termo) < 2:
        return []
    alunos = session.exec(
        select(Aluno)
        .where(Aluno.escola_id == usuario_atual.escola_id, Aluno.nome.ilike(f"%{termo}%"))
        .order_by(Aluno.nome)
        .limit(20)
    ).all()
    return [AlunoBusca(aluno_id=a.id, nome=a.nome, turma=a.turma) for a in alunos]


@router.get("/feirinha/extrato/{aluno_id}", response_model=ExtratoAluno)
def extrato(aluno_id: int, session: SessionDep, usuario_atual: CurrentUserDep):
    """Acumulado (= Patrimônio Disciplinar), quanto já gastou, quanto tem e cada compra."""
    aluno = session.get(Aluno, aluno_id)
    if aluno is None or aluno.escola_id != usuario_atual.escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aluno não encontrado.")

    patrimonio, gasto, saldo = calcular_saldo(session, aluno.escola_id, aluno.id)
    cartao = session.exec(
        select(CartaoAluno).where(CartaoAluno.aluno_id == aluno.id, CartaoAluno.ativo == True)  # noqa: E712
    ).first()

    debitos = session.exec(
        select(TransacaoVeracoin)
        .where(TransacaoVeracoin.aluno_id == aluno.id, TransacaoVeracoin.tipo == TipoTransacaoVeracoin.debito)
        .order_by(TransacaoVeracoin.criado_em.desc(), TransacaoVeracoin.id.desc())
    ).all()
    estornados = set(
        session.exec(
            select(TransacaoVeracoin.estorno_de_id).where(
                TransacaoVeracoin.estorno_de_id.in_([d.id for d in debitos] or [0])
            )
        ).all()
    )
    operadores = {
        u.id: u.nome
        for u in session.exec(select(Usuario).where(Usuario.id.in_({d.operador_id for d in debitos} or {0}))).all()
    }

    return ExtratoAluno(
        aluno_id=aluno.id,
        nome=aluno.nome,
        turma=aluno.turma,
        numero_cartao=cartao.numero if cartao else None,
        acumulado=math.floor(patrimonio + 1e-9),
        gasto=gasto,
        saldo=saldo,
        compras=[
            CompraExtrato(
                transacao_id=d.id,
                criado_em=d.criado_em,
                valor=d.valor,
                descricao=d.descricao,
                operador_nome=operadores.get(d.operador_id),
                estornado=d.id in estornados,
            )
            for d in debitos
        ],
    )
