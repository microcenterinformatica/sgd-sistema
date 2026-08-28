from datetime import datetime, timedelta, timezone
from typing import Optional, Sequence

from sqlmodel import Session

from app.models.aluno import Aluno
from app.models.configuracao_recuperacao import ConfiguracaoRecuperacao
from app.models.punicao import Punicao


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


def processar_recuperacao_aluno(
    aluno: Aluno, dias_para_recuperacao: int, pontos_recuperacao: int, agora: datetime
) -> int:
    """Desconta pontos de infração automaticamente depois que o aluno passa
    `dias_para_recuperacao` dias seguidos sem nenhuma infração nova.

    A contagem reinicia a cada infração nova (`aluno.data_ultima_infracao`).
    Se vários ciclos já se passaram sem ninguém abrir a tela do aluno nesse
    meio tempo (não há um robô/cron rodando isso — é calculado sob demanda
    ao ler os dados do aluno), aplica todos os ciclos vencidos de uma vez.
    """
    if (
        aluno.pontos_atuais <= 0
        or aluno.data_ultima_infracao is None
        or dias_para_recuperacao <= 0
        or pontos_recuperacao <= 0
    ):
        return 0

    ancora = aluno.data_ultima_recuperacao
    if ancora is None or ancora < aluno.data_ultima_infracao:
        ancora = aluno.data_ultima_infracao

    total_reduzido = 0
    while aluno.pontos_atuais > 0:
        proxima_recuperacao = ancora + timedelta(days=dias_para_recuperacao)
        if agora < proxima_recuperacao:
            break
        pontos_a_subtrair = min(aluno.pontos_atuais, pontos_recuperacao)
        aluno.pontos_atuais -= pontos_a_subtrair
        total_reduzido += pontos_a_subtrair
        ancora = proxima_recuperacao
        aluno.data_ultima_recuperacao = proxima_recuperacao

    return total_reduzido


def aplicar_recuperacoes_pendentes(session: Session, alunos: Sequence[Aluno], escola_id: int) -> None:
    """Chamado ao ler dados de alunos (lista, ficha, painel) para manter a
    recuperação automática de pontos em dia, sem depender de nenhum job
    agendado rodando em segundo plano."""
    config = session.get(ConfiguracaoRecuperacao, escola_id)
    if config is None or not config.ativo:
        return

    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    alterou = False
    for aluno in alunos:
        reduzido = processar_recuperacao_aluno(
            aluno, config.dias_para_recuperacao, config.pontos_recuperacao, agora
        )
        if reduzido > 0:
            session.add(aluno)
            alterou = True

    if alterou:
        session.commit()
