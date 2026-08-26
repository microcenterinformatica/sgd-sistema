from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models.atribuicao import Atribuicao
from app.models.professor import Professor
from app.models.turma import SegmentoTurma, Turma
from app.models.usuario import Usuario

PAPEIS_ACESSO_TOTAL = ("admin_escola", "coordenacao")


def buscar_professor_do_usuario(session: Session, usuario: Usuario) -> Professor | None:
    return session.exec(
        select(Professor).where(
            Professor.usuario_id == usuario.id, Professor.escola_id == usuario.escola_id
        )
    ).first()


def combinacoes_permitidas(session: Session, usuario_atual: Usuario) -> list[tuple[str, int]] | None:
    """Retorna None quando o usuário tem acesso total (admin/coordenação).
    Caso contrário, retorna a lista de (turma, disciplina_id) que o professor pode usar.
    """
    if usuario_atual.papel in PAPEIS_ACESSO_TOTAL:
        return None

    professor = buscar_professor_do_usuario(session, usuario_atual)
    if professor is None:
        return []

    atribuicoes = session.exec(
        select(Atribuicao).where(
            Atribuicao.professor_id == professor.id, Atribuicao.escola_id == usuario_atual.escola_id
        )
    ).all()
    return [(a.turma, a.disciplina_id) for a in atribuicoes]


def verificar_permissao_turma_disciplina(
    session: Session, usuario_atual: Usuario, turma: str, disciplina_id: int
) -> None:
    permitidas = combinacoes_permitidas(session, usuario_atual)
    if permitidas is None:
        return
    if (turma, disciplina_id) not in permitidas:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para lançar nesta turma/disciplina.",
        )


def segmento_da_turma(session: Session, escola_id: int, turma_nome: str) -> SegmentoTurma:
    """Retorna o segmento da turma (Fundamental 1/2). Se a turma não estiver cadastrada
    em `Turma` (string legada), assume Fundamental 2 — comportamento de faltas por
    disciplina, igual ao que já existia antes desse conceito."""
    turma = session.exec(
        select(Turma).where(Turma.escola_id == escola_id, Turma.nome == turma_nome)
    ).first()
    return turma.segmento if turma else SegmentoTurma.fundamental_2


def verificar_permissao_disciplina(
    session: Session, usuario_atual: Usuario, disciplina_id: int
) -> None:
    permitidas = combinacoes_permitidas(session, usuario_atual)
    if permitidas is None:
        return
    if not any(disc_id == disciplina_id for _, disc_id in permitidas):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para esta disciplina.",
        )
