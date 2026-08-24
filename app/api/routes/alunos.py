from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select

from app.api.deps import CurrentUserDep, SessionDep, require_roles
from app.models.aluno import Aluno
from app.models.usuario import PapelUsuario
from app.schemas.aluno import AlunoCreate, AlunoRead, AlunoUpdate

router = APIRouter(prefix="/alunos", tags=["alunos"])

GESTAO_ROLES = (PapelUsuario.admin_escola, PapelUsuario.coordenacao)


def _get_aluno_da_escola(session: SessionDep, aluno_id: int, escola_id: int) -> Aluno:
    aluno = session.get(Aluno, aluno_id)
    if aluno is None or aluno.escola_id != escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aluno não encontrado")
    return aluno


@router.post("", response_model=AlunoRead, status_code=status.HTTP_201_CREATED)
def criar_aluno(dados: AlunoCreate, session: SessionDep, usuario_atual=Depends(require_roles(*GESTAO_ROLES))):
    ja_existe = session.exec(
        select(Aluno).where(Aluno.escola_id == usuario_atual.escola_id, Aluno.matricula == dados.matricula)
    ).first()
    if ja_existe is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Matrícula já cadastrada")

    aluno = Aluno(escola_id=usuario_atual.escola_id, **dados.model_dump())
    session.add(aluno)
    session.commit()
    session.refresh(aluno)
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

    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(aluno, campo, valor)

    session.add(aluno)
    session.commit()
    session.refresh(aluno)
    return aluno


@router.delete("/{aluno_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_aluno(aluno_id: int, session: SessionDep, usuario_atual=Depends(require_roles(*GESTAO_ROLES))):
    aluno = _get_aluno_da_escola(session, aluno_id, usuario_atual.escola_id)
    session.delete(aluno)
    session.commit()
