from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import AbstractSet, Optional, Sequence

from sqlmodel import Session, select

from app.models.aluno import Aluno
from app.models.atividade import Atividade
from app.models.configuracao_recuperacao import ConfiguracaoRecuperacao
from app.models.lancamento import Lancamento
from app.models.punicao import Punicao
from app.models.registro_disciplinar import RegistroDisciplinar, TipoRegistro
from app.models.registro_falta import RegistroFalta

# Marcador (por enquanto só cosmético) do registro de histórico criado pela
# recuperação automática — usado pro frontend dar um rótulo/visual próprio a
# esse evento no Histórico, distinto de mérito dado por professor (ver
# frontend/app/historico/page.tsx). Conta normalmente como mérito no
# Ranking/Veracom (decisão do usuário: incentivo extra pro aluno se
# recuperar, não só reduzir indisciplina). Mesmo padrão de marcador por
# descrição já usado em DESCRICAO_MERITO_TURMA (app/api/routes/registros.py).
DESCRICAO_RECUPERACAO_AUTOMATICA = "RECUPERAÇÃO AUTOMÁTICA DE PONTOS"

# Marcador funcional (não só cosmético) do mérito automático pago pra quem já
# está zerado (sem nenhum ponto de indisciplina pendente) e passa o mesmo
# período de "dias de recuperação" sem nenhuma indisciplina, falta
# injustificada ou atividade não entregue. Diferente da recuperação acima,
# esse NÃO mexe em pontos_atuais (não tem o que reduzir) e fica de fora do
# Histórico de Ocorrências Disciplinares (ver exclusão em
# app/api/routes/registros.py e app/api/routes/alunos.py, mesmo padrão de
# DESCRICAO_MERITO_TURMA) — só soma Veracom no Ranking, como incentivo pro
# aluno exemplar. Decisão do usuário (ver conversa 2026-10-22).
DESCRICAO_BONUS_BOM_COMPORTAMENTO = "MÉRITO POR BOM COMPORTAMENTO CONTÍNUO"


def aplicar_infracao(aluno: Aluno, peso: int, agora: datetime) -> None:
    aluno.pontos_atuais = max(0, aluno.pontos_atuais + peso)
    aluno.data_ultima_infracao = agora


def aplicar_merito(aluno: Aluno, pontos_bonus: int) -> None:
    aluno.pontos_atuais = max(0, aluno.pontos_atuais - pontos_bonus)


def recalcular_apos_edicao(aluno: Aluno, peso_antigo: int, peso_novo: int) -> None:
    aluno.pontos_atuais = max(0, aluno.pontos_atuais - peso_antigo + peso_novo)


def calcular_punicao_aplicavel(punicoes: Sequence[Punicao], pontos: int) -> Optional[Punicao]:
    punicoes_ordenadas = sorted(
        (p for p in punicoes if p.ativo), key=lambda p: p.pontuacao_minima, reverse=True
    )
    for punicao in punicoes_ordenadas:
        if pontos >= punicao.pontuacao_minima:
            return punicao
    return None


def _somar_dias_de_aula(
    inicio: datetime,
    dias_necessarios: int,
    datas_falta: AbstractSet[date],
    datas_pendencia: AbstractSet[date] = frozenset(),
) -> datetime:
    """Soma `dias_necessarios` dias de aula a `inicio`: pula sábados,
    domingos, qualquer data em que o aluno tenha falta registrada (justificada
    ou não — o aluno precisa ter estado presente) e, quando informado,
    qualquer data com atividade/tarefa não entregue (usado só no bônus de bom
    comportamento, não na recuperação de pontos). Não considera feriados (sem
    cadastro disso ainda)."""
    data = inicio
    adicionados = 0
    while adicionados < dias_necessarios:
        data += timedelta(days=1)
        if (
            data.weekday() < 5  # 0=segunda ... 4=sexta
            and data.date() not in datas_falta
            and data.date() not in datas_pendencia
        ):
            adicionados += 1
    return data


def processar_recuperacao_aluno(
    aluno: Aluno,
    dias_para_recuperacao: int,
    pontos_recuperacao: int,
    agora: datetime,
    datas_falta: AbstractSet[date] = frozenset(),
    datas_pendencia: AbstractSet[date] = frozenset(),
) -> list[tuple[datetime, int, str]]:
    """Dois mecanismos no mesmo relógio (mesmo `dias_para_recuperacao`/
    `pontos_recuperacao` configurados pela escola):

    - Aluno com pontos de indisciplina (`pontos_atuais > 0`): desconta pontos
      automaticamente a cada `dias_para_recuperacao` dias DE AULA seguidos sem
      infração nova (sábados, domingos e dias de falta não contam). Gera
      RECUPERAÇÃO AUTOMÁTICA DE PONTOS, visível no Histórico.
    - Aluno já zerado (`pontos_atuais == 0`, com ou sem infração no passado):
      ganha mérito (Veracom) a cada `dias_para_recuperacao` dias de aula
      REALMENTE limpos — sem falta E sem nenhuma atividade/tarefa não
      entregue no meio — como incentivo por bom comportamento contínuo. Não
      mexe em pontos_atuais (não tem o que reduzir) e fica fora do Histórico
      de Ocorrências Disciplinares (ver DESCRICAO_BONUS_BOM_COMPORTAMENTO).
      Ninguém ganha crédito retroativo: na primeira vez que o aluno é
      avaliado por essa função (`aluno.data_inicio_bonus_comportamento is
      None` — campo novo só pra isso), se ele já estiver zerado o relógio do
      bônus é zerado pra "agora", mesmo que `data_ultima_recuperacao` já
      existisse de antes (recuperação de pontos antiga, de antes dessa
      função existir) — senão o aluno ganharia de uma vez vários ciclos
      "atrasados" que na verdade nunca foram prometidos a ele.

    A contagem reinicia a cada infração nova (`aluno.data_ultima_infracao`),
    nos dois casos. Se vários ciclos já se passaram sem ninguém abrir a tela
    do aluno nesse meio tempo (não há um robô/cron rodando isso — é calculado
    sob demanda ao ler os dados do aluno), aplica todos os ciclos vencidos de
    uma vez, podendo inclusive cruzar de um mecanismo pro outro no meio do
    lote (último desconto zera o aluno, ciclos seguintes já viram bônus).

    Retorna a lista de ciclos aplicados (data do ciclo, pontos, descrição) —
    quem chama usa isso pra criar o registro de histórico certo.
    """
    if dias_para_recuperacao <= 0 or pontos_recuperacao <= 0:
        return []

    if aluno.data_inicio_bonus_comportamento is None:
        aluno.data_inicio_bonus_comportamento = agora
        if aluno.pontos_atuais <= 0:
            aluno.data_ultima_recuperacao = agora

    ultima_infracao = aluno.data_ultima_infracao
    ultima_recuperacao = aluno.data_ultima_recuperacao

    if ultima_recuperacao is None:
        if ultima_infracao is not None:
            ancora = ultima_infracao
        else:
            # Nunca teve infração nem ciclo algum: só começa a contar a
            # partir de agora, sem crédito retroativo.
            aluno.data_ultima_recuperacao = agora
            return []
    elif ultima_infracao is not None and ultima_recuperacao < ultima_infracao:
        ancora = ultima_infracao
    else:
        ancora = ultima_recuperacao

    ciclos: list[tuple[datetime, int, str]] = []
    while True:
        zerado = aluno.pontos_atuais <= 0
        proxima = _somar_dias_de_aula(
            ancora, dias_para_recuperacao, datas_falta, datas_pendencia if zerado else frozenset()
        )
        if agora < proxima:
            break
        if zerado:
            pontos = pontos_recuperacao
            descricao = DESCRICAO_BONUS_BOM_COMPORTAMENTO
        else:
            pontos = min(aluno.pontos_atuais, pontos_recuperacao)
            aluno.pontos_atuais -= pontos
            descricao = DESCRICAO_RECUPERACAO_AUTOMATICA
        ciclos.append((proxima, pontos, descricao))
        ancora = proxima
        aluno.data_ultima_recuperacao = proxima

    return ciclos


def aplicar_recuperacoes_pendentes(session: Session, alunos: Sequence[Aluno], escola_id: int) -> None:
    """Chamado ao ler dados de alunos (lista, ficha, painel) para manter a
    recuperação automática de pontos e o bônus de bom comportamento em dia,
    sem depender de nenhum job agendado rodando em segundo plano. Cada ciclo
    aplicado também grava um RegistroDisciplinar (tipo mérito, marcado por
    descrição) — sem isso o total de pontos/Veracom do aluno não batia com a
    soma das ocorrências listadas."""
    config = session.get(ConfiguracaoRecuperacao, escola_id)
    if config is None or not config.ativo:
        return

    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    elegiveis = list(alunos)
    if not elegiveis:
        return

    datas_referencia = [
        d
        for a in elegiveis
        for d in (a.data_ultima_infracao, a.data_ultima_recuperacao)
        if d is not None
    ]
    datas_falta_por_aluno: dict[int, set] = defaultdict(set)
    datas_pendencia_por_aluno: dict[int, set] = defaultdict(set)
    if datas_referencia:
        data_minima = min(datas_referencia).date()
        ids_alunos = [a.id for a in elegiveis]

        faltas = session.exec(
            select(RegistroFalta.aluno_id, RegistroFalta.data).where(
                RegistroFalta.escola_id == escola_id,
                RegistroFalta.aluno_id.in_(ids_alunos),
                RegistroFalta.data >= data_minima,
                RegistroFalta.data <= agora.date(),
            )
        ).all()
        for aluno_id, data_falta in faltas:
            datas_falta_por_aluno[aluno_id].add(data_falta)

        pendencias = session.exec(
            select(Lancamento.aluno_id, Atividade.data_entrega, Atividade.data)
            .join(Atividade, Lancamento.atividade_id == Atividade.id)
            .where(
                Atividade.escola_id == escola_id,
                Atividade.ativo == True,  # noqa: E712
                Lancamento.fez == False,  # noqa: E712
                Lancamento.aluno_id.in_(ids_alunos),
            )
        ).all()
        for aluno_id, data_entrega, data_atividade in pendencias:
            referencia = data_entrega or data_atividade
            if referencia is not None and referencia >= data_minima:
                datas_pendencia_por_aluno[aluno_id].add(referencia)

    alterou = False
    for aluno in elegiveis:
        anchor_antes = aluno.data_ultima_recuperacao
        marco_antes = aluno.data_inicio_bonus_comportamento
        ciclos = processar_recuperacao_aluno(
            aluno,
            config.dias_para_recuperacao,
            config.pontos_recuperacao,
            agora,
            datas_falta_por_aluno.get(aluno.id, frozenset()),
            datas_pendencia_por_aluno.get(aluno.id, frozenset()),
        )
        mudou_anchor = aluno.data_ultima_recuperacao != anchor_antes
        mudou_marco = aluno.data_inicio_bonus_comportamento != marco_antes
        if not ciclos and not mudou_anchor and not mudou_marco:
            continue
        session.add(aluno)
        for data_hora_ciclo, pontos, descricao in ciclos:
            session.add(
                RegistroDisciplinar(
                    aluno_id=aluno.id,
                    tipo=TipoRegistro.merito,
                    regra_id=None,
                    descricao=descricao,
                    peso=-pontos,
                    data_hora=data_hora_ciclo,
                    observacao=None,
                    professor_id=None,
                    registrado_por_usuario_id=None,
                )
            )
        alterou = True

    if alterou:
        session.commit()
