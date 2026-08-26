from datetime import date

from sqlmodel import select

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUserDep, SessionDep
from app.core.permissoes import (
    buscar_professor_do_usuario,
    segmento_da_turma,
    verificar_permissao_turma_disciplina,
)
from app.models.aluno import Aluno
from app.models.conteudo_aula import ConteudoAula
from app.models.registro_falta import RegistroFalta
from app.models.turma import SegmentoTurma
from app.schemas.falta import (
    ChamadaAlunoStatus,
    ChamadaRead,
    ChamadaSalvar,
    ConteudoAulaRead,
    FaltaRead,
    FaltaResumoItem,
)

router = APIRouter(prefix="/faltas", tags=["faltas"])


def _listar_alunos_por_turma(session: SessionDep, escola_id: int, turma: str | None) -> list[Aluno]:
    query = select(Aluno).where(Aluno.escola_id == escola_id)
    if turma:
        query = query.where(Aluno.turma == turma)
    query = query.order_by(Aluno.numero_chamada.is_(None), Aluno.numero_chamada, Aluno.nome)
    return session.exec(query).all()


@router.get("/alunos-turma")
def listar_alunos_da_turma(turma: str, session: SessionDep, usuario_atual: CurrentUserDep):
    alunos = _listar_alunos_por_turma(session, usuario_atual.escola_id, turma)
    return [
        {"id": a.id, "nome": a.nome, "matricula": a.matricula, "turma": a.turma, "numero_chamada": a.numero_chamada}
        for a in alunos
    ]


def _montar_chamada(
    session: SessionDep, usuario_atual: CurrentUserDep, turma: str, disciplina_id: int, data: date
) -> ChamadaRead:
    alunos = _listar_alunos_por_turma(session, usuario_atual.escola_id, turma)
    aluno_ids = [a.id for a in alunos]

    segmento = segmento_da_turma(session, usuario_atual.escola_id, turma)
    filtro_disciplina = (
        RegistroFalta.disciplina_id.is_(None)
        if segmento == SegmentoTurma.fundamental_1
        else RegistroFalta.disciplina_id == disciplina_id
    )
    faltas_do_dia = session.exec(
        select(RegistroFalta).where(
            RegistroFalta.escola_id == usuario_atual.escola_id,
            filtro_disciplina,
            RegistroFalta.data == data,
            RegistroFalta.aluno_id.in_(aluno_ids),
        )
    ).all()
    faltas_por_aluno = {f.aluno_id: f for f in faltas_do_dia}

    conteudo_aula = session.exec(
        select(ConteudoAula).where(
            ConteudoAula.escola_id == usuario_atual.escola_id,
            ConteudoAula.disciplina_id == disciplina_id,
            ConteudoAula.turma == turma,
            ConteudoAula.data == data,
        )
    ).first()

    return ChamadaRead(
        turma=turma,
        disciplina_id=disciplina_id,
        data=data,
        conteudo=conteudo_aula.conteudo if conteudo_aula else None,
        alunos=[
            ChamadaAlunoStatus(
                aluno_id=a.id,
                aluno_nome=a.nome,
                matricula=a.matricula,
                numero_chamada=a.numero_chamada,
                ausente=a.id in faltas_por_aluno,
                justificada=faltas_por_aluno[a.id].justificada if a.id in faltas_por_aluno else False,
                observacao=faltas_por_aluno[a.id].observacao if a.id in faltas_por_aluno else None,
            )
            for a in alunos
        ],
    )


@router.get("/chamada", response_model=ChamadaRead)
def buscar_chamada(
    turma: str, disciplina_id: int, data: date, session: SessionDep, usuario_atual: CurrentUserDep
):
    verificar_permissao_turma_disciplina(session, usuario_atual, turma, disciplina_id)
    return _montar_chamada(session, usuario_atual, turma, disciplina_id, data)


@router.post("/chamada", response_model=ChamadaRead)
def salvar_chamada(dados: ChamadaSalvar, session: SessionDep, usuario_atual: CurrentUserDep):
    verificar_permissao_turma_disciplina(session, usuario_atual, dados.turma, dados.disciplina_id)

    alunos = _listar_alunos_por_turma(session, usuario_atual.escola_id, dados.turma)
    aluno_ids_da_turma = {a.id for a in alunos}
    for item in dados.faltas:
        if item.aluno_id not in aluno_ids_da_turma:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Aluno {item.aluno_id} não é dessa turma"
            )

    segmento = segmento_da_turma(session, usuario_atual.escola_id, dados.turma)
    e_fundamental_1 = segmento == SegmentoTurma.fundamental_1
    filtro_disciplina = (
        RegistroFalta.disciplina_id.is_(None) if e_fundamental_1 else RegistroFalta.disciplina_id == dados.disciplina_id
    )

    faltas_existentes = session.exec(
        select(RegistroFalta).where(
            RegistroFalta.escola_id == usuario_atual.escola_id,
            filtro_disciplina,
            RegistroFalta.data == dados.data,
            RegistroFalta.aluno_id.in_(aluno_ids_da_turma),
        )
    ).all()
    for falta in faltas_existentes:
        session.delete(falta)

    for item in dados.faltas:
        session.add(
            RegistroFalta(
                aluno_id=item.aluno_id,
                escola_id=usuario_atual.escola_id,
                disciplina_id=None if e_fundamental_1 else dados.disciplina_id,
                data=dados.data,
                justificada=item.justificada,
                observacao=item.observacao,
                registrado_por_usuario_id=usuario_atual.id,
            )
        )

    conteudo_aula = session.exec(
        select(ConteudoAula).where(
            ConteudoAula.escola_id == usuario_atual.escola_id,
            ConteudoAula.disciplina_id == dados.disciplina_id,
            ConteudoAula.turma == dados.turma,
            ConteudoAula.data == dados.data,
        )
    ).first()

    conteudo_texto = (dados.conteudo or "").strip()
    if conteudo_texto:
        if conteudo_aula is None:
            professor = buscar_professor_do_usuario(session, usuario_atual)
            conteudo_aula = ConteudoAula(
                escola_id=usuario_atual.escola_id,
                professor_id=professor.id if professor else None,
                disciplina_id=dados.disciplina_id,
                turma=dados.turma,
                data=dados.data,
                conteudo=conteudo_texto,
                registrado_por_usuario_id=usuario_atual.id,
            )
        else:
            conteudo_aula.conteudo = conteudo_texto
        session.add(conteudo_aula)
    elif conteudo_aula is not None:
        session.delete(conteudo_aula)

    session.commit()
    return _montar_chamada(session, usuario_atual, dados.turma, dados.disciplina_id, dados.data)


@router.get("/conteudo", response_model=list[ConteudoAulaRead])
def listar_conteudos(turma: str, disciplina_id: int, session: SessionDep, usuario_atual: CurrentUserDep):
    verificar_permissao_turma_disciplina(session, usuario_atual, turma, disciplina_id)
    conteudos = session.exec(
        select(ConteudoAula)
        .where(
            ConteudoAula.escola_id == usuario_atual.escola_id,
            ConteudoAula.disciplina_id == disciplina_id,
            ConteudoAula.turma == turma,
        )
        .order_by(ConteudoAula.data.desc())
    ).all()
    return conteudos


@router.get("", response_model=list[FaltaRead])
def listar_faltas(
    session: SessionDep,
    usuario_atual: CurrentUserDep,
    aluno_id: int | None = None,
    disciplina_id: int | None = None,
):
    query = select(RegistroFalta).where(RegistroFalta.escola_id == usuario_atual.escola_id)
    if aluno_id is not None:
        query = query.where(RegistroFalta.aluno_id == aluno_id)
        aluno = session.get(Aluno, aluno_id)
        if aluno and aluno.turma and segmento_da_turma(session, usuario_atual.escola_id, aluno.turma) == SegmentoTurma.fundamental_1:
            query = query.where(RegistroFalta.disciplina_id.is_(None))
        elif disciplina_id is not None:
            query = query.where(RegistroFalta.disciplina_id == disciplina_id)
    elif disciplina_id is not None:
        query = query.where(RegistroFalta.disciplina_id == disciplina_id)
    query = query.order_by(RegistroFalta.data.desc())
    return session.exec(query).all()


@router.get("/resumo", response_model=list[FaltaResumoItem])
def resumo_faltas(
    disciplina_id: int, session: SessionDep, usuario_atual: CurrentUserDep, turma: str | None = None
):
    if turma and segmento_da_turma(session, usuario_atual.escola_id, turma) == SegmentoTurma.fundamental_1:
        aluno_ids_da_turma = [a.id for a in _listar_alunos_por_turma(session, usuario_atual.escola_id, turma)]
        faltas = session.exec(
            select(RegistroFalta).where(
                RegistroFalta.escola_id == usuario_atual.escola_id,
                RegistroFalta.disciplina_id.is_(None),
                RegistroFalta.aluno_id.in_(aluno_ids_da_turma),
            )
        ).all()
    else:
        faltas = session.exec(
            select(RegistroFalta).where(
                RegistroFalta.escola_id == usuario_atual.escola_id,
                RegistroFalta.disciplina_id == disciplina_id,
            )
        ).all()

    totais: dict[int, int] = {}
    for f in faltas:
        totais[f.aluno_id] = totais.get(f.aluno_id, 0) + 1

    alunos = _listar_alunos_por_turma(session, usuario_atual.escola_id, None)
    nomes_por_id = {a.id: a.nome for a in alunos}

    return [
        FaltaResumoItem(aluno_id=aluno_id, aluno_nome=nomes_por_id.get(aluno_id, "?"), total_faltas=total)
        for aluno_id, total in totais.items()
    ]
