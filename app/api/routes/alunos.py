from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from app.api.deps import CurrentUserDep, SessionDep, require_roles
from app.core.ano_letivo import ano_letivo_atual
from app.models.aluno import Aluno
from app.models.matricula_turma import MatriculaTurma
from app.models.registro_disciplinar import RegistroDisciplinar
from app.models.turma import Turma
from app.models.usuario import PapelUsuario
from app.schemas.aluno import AlunoCreate, AlunoRead, AlunoUpdate

router = APIRouter(prefix="/alunos", tags=["alunos"])

GESTAO_ROLES = (PapelUsuario.admin_escola, PapelUsuario.coordenacao)


def _get_aluno_da_escola(session: SessionDep, aluno_id: int, escola_id: int) -> Aluno:
    aluno = session.get(Aluno, aluno_id)
    if aluno is None or aluno.escola_id != escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aluno não encontrado")
    return aluno


def _sincronizar_matricula_turma(session: SessionDep, aluno: Aluno) -> None:
    """Grava/atualiza o histórico de matrícula por ano letivo a partir da turma
    atual do aluno, sem afetar em nada as telas que já usam aluno.turma direto."""
    if not aluno.turma:
        return
    ano = ano_letivo_atual(session, aluno.escola_id)
    if ano is None:
        return
    turma = session.exec(
        select(Turma).where(Turma.escola_id == aluno.escola_id, Turma.nome == aluno.turma)
    ).first()
    if turma is None:
        return

    matricula = session.exec(
        select(MatriculaTurma).where(
            MatriculaTurma.aluno_id == aluno.id, MatriculaTurma.ano_letivo_id == ano.id
        )
    ).first()
    if matricula is None:
        matricula = MatriculaTurma(aluno_id=aluno.id, turma_id=turma.id, ano_letivo_id=ano.id)
    matricula.turma_id = turma.id
    matricula.numero_chamada = aluno.numero_chamada
    session.add(matricula)


@router.post("", response_model=AlunoRead, status_code=status.HTTP_201_CREATED)
def criar_aluno(dados: AlunoCreate, session: SessionDep, usuario_atual=Depends(require_roles(*GESTAO_ROLES))):
    ja_existe = session.exec(
        select(Aluno).where(Aluno.escola_id == usuario_atual.escola_id, Aluno.matricula == dados.matricula)
    ).first()
    if ja_existe is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Matrícula já cadastrada")

    aluno = Aluno(escola_id=usuario_atual.escola_id, **dados.model_dump())
    session.add(aluno)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Turma '{dados.turma}' não encontrada. Cadastre a turma antes de vincular o aluno a ela.",
        )
    session.refresh(aluno)

    _sincronizar_matricula_turma(session, aluno)
    session.commit()

    return aluno


@router.get("", response_model=list[AlunoRead])
def listar_alunos(session: SessionDep, usuario_atual: CurrentUserDep):
    return session.exec(select(Aluno).where(Aluno.escola_id == usuario_atual.escola_id)).all()


@router.get("/proxima-matricula")
def proxima_matricula(session: SessionDep, usuario_atual=Depends(require_roles(*GESTAO_ROLES))):
    """Sugere a próxima matrícula (maior matrícula numérica já usada na escola + 1)."""
    matriculas = session.exec(
        select(Aluno.matricula).where(Aluno.escola_id == usuario_atual.escola_id)
    ).all()
    maior = 0
    for m in matriculas:
        if m and m.isdigit():
            maior = max(maior, int(m))
    return {"matricula": str(maior + 1)}


@router.get("/{aluno_id}", response_model=AlunoRead)
def obter_aluno(aluno_id: int, session: SessionDep, usuario_atual: CurrentUserDep):
    return _get_aluno_da_escola(session, aluno_id, usuario_atual.escola_id)


@router.put("/{aluno_id}", response_model=AlunoRead)
def atualizar_aluno(
    aluno_id: int,
    dados: AlunoUpdate,
    session: SessionDep,
    usuario_atual=Depends(require_roles(*GESTAO_ROLES)),
):
    aluno = _get_aluno_da_escola(session, aluno_id, usuario_atual.escola_id)

    campos_alterados = dados.model_dump(exclude_unset=True)
    turma_tentada = campos_alterados.get("turma", aluno.turma)
    for campo, valor in campos_alterados.items():
        setattr(aluno, campo, valor)

    session.add(aluno)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Turma '{turma_tentada}' não encontrada. Cadastre a turma antes de vincular o aluno a ela.",
        )
    session.refresh(aluno)

    if "turma" in campos_alterados or "numero_chamada" in campos_alterados:
        _sincronizar_matricula_turma(session, aluno)
        session.commit()

    return aluno


@router.delete("/{aluno_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_aluno(aluno_id: int, session: SessionDep, usuario_atual=Depends(require_roles(*GESTAO_ROLES))):
    aluno = _get_aluno_da_escola(session, aluno_id, usuario_atual.escola_id)

    total_registros = session.exec(
        select(func.count()).select_from(RegistroDisciplinar).where(RegistroDisciplinar.aluno_id == aluno_id)
    ).one()
    if total_registros > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Não é possível excluir {aluno.nome}: há {total_registros} registro(s) disciplinar(es) "
                "(infrações/méritos) vinculados a este aluno. Remova o histórico dele antes de excluí-lo."
            ),
        )

    try:
        session.delete(aluno)
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Não é possível excluir {aluno.nome}: existem registros vinculados a este aluno.",
        )
