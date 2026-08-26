from datetime import date

from sqlmodel import Session, select

from app.models.ano_letivo import AnoLetivo


def ano_letivo_atual(session: Session, escola_id: int) -> AnoLetivo | None:
    """Ano letivo "vigente" da escola: prioriza o que cobre a data de hoje pelas
    datas cadastradas; senão, o que está marcado como aberto (só existe um, ver
    criar_ano_letivo); na falta disso, o mais recente por número de ano."""
    hoje = date.today()
    anos = session.exec(select(AnoLetivo).where(AnoLetivo.escola_id == escola_id)).all()
    if not anos:
        return None

    for ano in anos:
        if ano.data_inicio and ano.data_fim and ano.data_inicio <= hoje <= ano.data_fim:
            return ano

    abertos = [a for a in anos if a.situacao == "aberto"]
    if abertos:
        return max(abertos, key=lambda a: a.ano)

    return max(anos, key=lambda a: a.ano)
