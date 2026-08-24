from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select

from app.api.deps import CurrentUserDep, SessionDep, require_roles
from app.models.professor import Professor
from app.models.usuario import PapelUsuario
from app.schemas.professor import ProfessorCreate, ProfessorRead, ProfessorUpdate

router = APIRouter(prefix="/professores", tags=["professores"])

GESTAO_ROLES = (PapelUsuario.admin_escola, PapelUsuario.coordenacao)


def _get_professor_da_escola(session: SessionDep, professor_id: int, escola_id: int) -> Professor:
    professor = session.get(Professor, professor_id)
    if professor is None or professor.escola_id != escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Professor não encontrado")
    return professor


@router.post("", response_model=ProfessorRead, status_code=status.HTTP_201_CREATED)
def criar_professor(dados: ProfessorCreate, session: SessionDep, usuario_atual=Depends(require_roles(*GESTAO_ROLES))):
    professor = Professor(escola_id=usuario_atual.escola_id, **dados.model_dump())
    session.add(professor)
    session.commit()
    session.refresh(professor)
    return professor


@router.get("", response_model=list[ProfessorRead])
def listar_professores(session: SessionDep, usuario_atual: CurrentUserDep):
    return session.exec(select(Professor).where(Professor.escola_id == usuario_atual.escola_id)).all()


@router.get("/{professor_id}", response_model=ProfessorRead)
def obter_professor(professor_id: int, session: SessionDep, usuario_atual: CurrentUserDep):
    return _get_professor_da_escola(session, professor_id, usuario_atual.escola_id)


@router.put("/{professor_id}", response_model=ProfessorRead)
def atualizar_professor(
    professor_id: int,
    dados: ProfessorUpdate,
    session: SessionDep,
    usuario_atual=Depends(require_roles(*GESTAO_ROLES)),
):
    professor = _get_professor_da_escola(session, professor_id, usuario_atual.escola_id)

    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(professor, campo, valor)

    session.add(professor)
    session.commit()
    session.refresh(professor)
    return professor


@router.delete("/{professor_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_professor(professor_id: int, session: SessionDep, usuario_atual=Depends(require_roles(*GESTAO_ROLES))):
    professor = _get_professor_da_escola(session, professor_id, usuario_atual.escola_id)
    session.delete(professor)
    session.commit()
