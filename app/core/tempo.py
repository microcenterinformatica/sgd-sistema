from datetime import datetime, timedelta, timezone

# Escolas atendidas ficam no fuso de Brasília, que desde 2019 não observa
# mais horário de verão — por isso um offset fixo é suficiente e evita
# depender do pacote tzdata em ambientes onde ele não está instalado.
FUSO_BRASIL = timezone(timedelta(hours=-3))


def agora_utc() -> datetime:
    """Horário atual em UTC, sem tzinfo (formato usado para persistência)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def para_horario_local(momento: datetime) -> datetime:
    """Converte um datetime armazenado em UTC (naive ou aware) para o horário de Brasília."""
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=timezone.utc)
    return momento.astimezone(FUSO_BRASIL)
