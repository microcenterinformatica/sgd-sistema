from datetime import datetime, timedelta
from typing import Optional, Sequence

from app.models.aluno import Aluno
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
    if aluno.pontos_atuais <= 0:
        return 0

    if aluno.data_ultima_recuperacao is not None:
        proxima_recuperacao = aluno.data_ultima_recuperacao + timedelta(days=dias_para_recuperacao)
        if agora < proxima_recuperacao:
            return 0

    pontos_a_subtrair = min(aluno.pontos_atuais, pontos_recuperacao)
    aluno.pontos_atuais -= pontos_a_subtrair
    aluno.data_ultima_recuperacao = agora
    return pontos_a_subtrair
