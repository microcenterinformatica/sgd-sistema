from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select

from app.api.deps import CurrentUserDep, SessionDep, require_roles
from app.core.permissoes import combinacoes_permitidas
from app.models.aluno import Aluno
from app.models.atribuicao import Atribuicao
from app.models.disciplina import Disciplina
from app.models.professor import Professor
from app.schemas.atribuicao import (
    AtribuicaoCreate,
    AtribuicaoRead,
    MinhasAtribuicoesRead,
    TurmaDisciplinaPermitida,
)

router = APIRouter(tags=["atribuicoes"])

GerenciarAtribuicoes = Depends(require_roles("admin_escola", "coordenacao"))


def _listar_professores(session: SessionDep, escola_id: int) -> list[Professor]:
    return session.exec(
        select(Professor).where(Professor.escola_id == escola_id).order_by(Professor.nome)
    ).all()


def _listar_turmas(session: SessionDep, escola_id: int) -> list[str]:
    return session.exec(
        select(Aluno.turma)
        .where(Aluno.escola_id == escola_id, Aluno.turma.is_not(None))
        .distinct()
        .order_by(Aluno.turma)
    ).all()


@router.get("/atribuicoes", response_model=list[AtribuicaoRead], dependencies=[GerenciarAtribuicoes])
def listar_atribuicoes(session: SessionDep, usuario_atual: CurrentUserDep):
    atribuicoes = session.exec(
        select(Atribuicao).where(Atribuicao.escola_id == usuario_atual.escola_id)
    ).all()
    professores = {p.id: p.nome for p in _listar_professores(session, usuario_atual.escola_id)}
    disciplinas = {
        d.id: d.nome
        for d in session.exec(select(Disciplina).where(Disciplina.escola_id == usuario_atual.escola_id)).all()
    }
    return [
        AtribuicaoRead(
            id=a.id,
            professor_id=a.professor_id,
            professor_nome=professores.get(a.professor_id, "?"),
            disciplina_id=a.disciplina_id,
            disciplina_nome=disciplinas.get(a.disciplina_id, "?"),
            turma=a.turma,
        )
        for a in atribuicoes
    ]


@router.post(
    "/atribuicoes",
    response_model=AtribuicaoRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[GerenciarAtribuicoes],
)
def criar_atribuicao(dados: AtribuicaoCreate, session: SessionDep, usuario_atual: CurrentUserDep):
    disciplina = session.get(Disciplina, dados.disciplina_id)
    if disciplina is None or disciplina.escola_id != usuario_atual.escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disciplina não encontrada")

    professores = {p.id: p.nome for p in _listar_professores(session, usuario_atual.escola_id)}
    if dados.professor_id not in professores:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Professor não encontrado")

    existente = session.exec(
        select(Atribuicao).where(
            Atribuicao.escola_id == usuario_atual.escola_id,
            Atribuicao.professor_id == dados.professor_id,
            Atribuicao.disciplina_id == dados.disciplina_id,
            Atribuicao.turma == dados.turma,
        )
    ).first()
    if existente is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esse professor já está atribuído a essa disciplina nessa turma.",
        )

    atribuicao = Atribuicao(
        escola_id=usuario_atual.escola_id,
        professor_id=dados.professor_id,
        disciplina_id=dados.disciplina_id,
        turma=dados.turma,
    )
    session.add(atribuicao)
    session.commit()
    session.refresh(atribuicao)
    return AtribuicaoRead(
        id=atribuicao.id,
        professor_id=atribuicao.professor_id,
        professor_nome=professores[dados.professor_id],
        disciplina_id=atribuicao.disciplina_id,
        disciplina_nome=disciplina.nome,
        turma=atribuicao.turma,
    )


@router.delete("/atribuicoes/{atribuicao_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[GerenciarAtribuicoes])
def excluir_atribuicao(atribuicao_id: int, session: SessionDep, usuario_atual: CurrentUserDep):
    atribuicao = session.get(Atribuicao, atribuicao_id)
    if atribuicao is None or atribuicao.escola_id != usuario_atual.escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Atribuição não encontrada")
    session.delete(atribuicao)
    session.commit()


@router.get("/minhas-atribuicoes", response_model=MinhasAtribuicoesRead)
def minhas_atribuicoes(session: SessionDep, usuario_atual: CurrentUserDep):
    permitidas = combinacoes_permitidas(session, usuario_atual)

    disciplinas = {
        d.id: d.nome
        for d in session.exec(
            select(Disciplina).where(Disciplina.escola_id == usuario_atual.escola_id, Disciplina.ativo == True)  # noqa: E712
        ).all()
    }

    if permitidas is None:
        turmas = _listar_turmas(session, usuario_atual.escola_id)
        combinacoes = [
            TurmaDisciplinaPermitida(turma=t, disciplina_id=d_id, disciplina_nome=nome)
            for t in turmas
            for d_id, nome in disciplinas.items()
        ]
        return MinhasAtribuicoesRead(acesso_total=True, combinacoes=combinacoes)

    combinacoes = [
        TurmaDisciplinaPermitida(turma=turma, disciplina_id=disciplina_id, disciplina_nome=disciplinas.get(disciplina_id, "?"))
        for turma, disciplina_id in permitidas
    ]
    return MinhasAtribuicoesRead(acesso_total=False, combinacoes=combinacoes)
