from calendar import monthrange
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter
from sqlmodel import func, select

from app.api.deps import CurrentUserDep, SessionDep
from app.core.permissoes import turmas_permitidas
from app.models.aluno import Aluno
from app.models.configuracao_recuperacao import ConfiguracaoRecuperacao
from app.models.professor import Professor
from app.models.punicao import Punicao
from app.models.registro_disciplinar import RegistroDisciplinar, TipoRegistro
from app.models.usuario import Usuario
from app.schemas.painel import AlunoAlerta, PainelResumo, RegistroRecente

router = APIRouter(prefix="/painel", tags=["painel"])


def _query_alunos(escola_id: int, turmas: Optional[list[str]]):
    query = select(Aluno).where(Aluno.escola_id == escola_id)
    if turmas is not None:
        query = query.where(Aluno.turma.in_(turmas))
    return query


def _calcular_alerta(aluno: Aluno, punicoes: list[Punicao], pontos_para_alerta: int) -> Optional[AlunoAlerta]:
    if aluno.pontos_atuais <= 0:
        return None

    atingidas = [p for p in punicoes if p.pontuacao_minima <= aluno.pontos_atuais]
    punicao_atual = max(atingidas, key=lambda p: p.pontuacao_minima) if atingidas else None

    nao_atingidas = [p for p in punicoes if p.pontuacao_minima > aluno.pontos_atuais]
    proxima = min(nao_atingidas, key=lambda p: p.pontuacao_minima) if nao_atingidas else None
    pontos_faltantes = proxima.pontuacao_minima - aluno.pontos_atuais if proxima else None

    esta_perto = pontos_faltantes is not None and pontos_faltantes <= pontos_para_alerta
    if punicao_atual is None and not esta_perto:
        return None

    return AlunoAlerta(
        aluno_id=aluno.id,
        aluno_nome=aluno.nome,
        turma=aluno.turma,
        pontos_atuais=aluno.pontos_atuais,
        punicao_atual=punicao_atual.descricao if punicao_atual else None,
        proxima_punicao=proxima.descricao if proxima else None,
        pontos_faltantes=pontos_faltantes,
    )


@router.get("/resumo", response_model=PainelResumo)
def resumo_painel(session: SessionDep, usuario_atual: CurrentUserDep):
    escola_id = usuario_atual.escola_id
    turmas = turmas_permitidas(session, usuario_atual)

    alunos = session.exec(_query_alunos(escola_id, turmas)).all()
    total_alunos = len(alunos)

    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    inicio_mes = agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    ultimo_dia = monthrange(agora.year, agora.month)[1]
    fim_mes = agora.replace(day=ultimo_dia, hour=23, minute=59, second=59, microsecond=999999)

    query_mes = (
        select(RegistroDisciplinar.tipo, func.count(), func.sum(func.abs(RegistroDisciplinar.peso)))
        .join(Aluno)
        .where(
            Aluno.escola_id == escola_id,
            RegistroDisciplinar.data_hora >= inicio_mes,
            RegistroDisciplinar.data_hora <= fim_mes,
        )
    )
    if turmas is not None:
        query_mes = query_mes.where(Aluno.turma.in_(turmas))
    query_mes = query_mes.group_by(RegistroDisciplinar.tipo)

    ocorrencias_mes = 0
    pontos_merito_mes = 0
    for tipo, quantidade, soma_peso in session.exec(query_mes).all():
        if tipo == TipoRegistro.infracao:
            ocorrencias_mes = quantidade
        elif tipo == TipoRegistro.merito:
            pontos_merito_mes = soma_peso or 0

    punicoes = session.exec(
        select(Punicao).where(Punicao.escola_id == escola_id, Punicao.ativo == True)  # noqa: E712
    ).all()
    config_recuperacao = session.get(ConfiguracaoRecuperacao, escola_id)
    pontos_para_alerta = config_recuperacao.pontos_recuperacao if config_recuperacao else 2

    alunos_alerta = [
        alerta
        for aluno in alunos
        if (alerta := _calcular_alerta(aluno, punicoes, pontos_para_alerta)) is not None
    ]
    alunos_alerta.sort(key=lambda a: a.pontos_atuais, reverse=True)

    query_recentes = select(RegistroDisciplinar).join(Aluno).where(Aluno.escola_id == escola_id)
    if turmas is not None:
        query_recentes = query_recentes.where(Aluno.turma.in_(turmas))
    query_recentes = query_recentes.order_by(RegistroDisciplinar.data_hora.desc()).limit(8)
    registros_recentes = session.exec(query_recentes).all()

    professores_por_id = {p.id: p for p in session.exec(select(Professor).where(Professor.escola_id == escola_id))}
    usuarios_por_id = {u.id: u for u in session.exec(select(Usuario).where(Usuario.escola_id == escola_id))}
    alunos_por_id = {a.id: a for a in alunos}

    def professor_nome_de(registro: RegistroDisciplinar) -> Optional[str]:
        if registro.professor_id is not None:
            professor = professores_por_id.get(registro.professor_id)
            return professor.nome if professor else None
        usuario = usuarios_por_id.get(registro.registrado_por_usuario_id)
        return usuario.nome if usuario else None

    recentes = [
        RegistroRecente(
            **r.model_dump(),
            professor_nome=professor_nome_de(r),
            aluno_nome=alunos_por_id[r.aluno_id].nome if r.aluno_id in alunos_por_id else "Aluno",
        )
        for r in registros_recentes
    ]

    return PainelResumo(
        escopo="turmas" if turmas is not None else "total",
        turmas=turmas or [],
        total_alunos=total_alunos,
        ocorrencias_mes=ocorrencias_mes,
        pontos_merito_mes=pontos_merito_mes,
        alunos_alerta=alunos_alerta,
        recentes=recentes,
    )
