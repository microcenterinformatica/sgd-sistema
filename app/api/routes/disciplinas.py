from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from app.api.deps import CurrentUserDep, SessionDep, require_roles
from app.models.disciplina import Disciplina
from app.schemas.disciplina import DisciplinaCreate, DisciplinaRead, DisciplinaUpdate

router = APIRouter(tags=["disciplinas"])

GerenciarDisciplinas = Depends(require_roles("admin_escola", "coordenacao"))


def _get_disciplina_da_escola(session: SessionDep, disciplina_id: int, escola_id: int) -> Disciplina:
    disciplina = session.get(Disciplina, disciplina_id)
    if disciplina is None or disciplina.escola_id != escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disciplina não encontrada")
    return disciplina


@router.get("/disciplinas", response_model=list[DisciplinaRead])
def listar_disciplinas(session: SessionDep, usuario_atual: CurrentUserDep):
    query = select(Disciplina).where(
        Disciplina.escola_id == usuario_atual.escola_id, Disciplina.ativo == True  # noqa: E712
    ).order_by(Disciplina.nome)
    return session.exec(query).all()


@router.post(
    "/disciplinas",
    response_model=DisciplinaRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[GerenciarDisciplinas],
)
def criar_disciplina(dados: DisciplinaCreate, session: SessionDep, usuario_atual: CurrentUserDep):
    disciplina = Disciplina(escola_id=usuario_atual.escola_id, nome=dados.nome)
    session.add(disciplina)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já existe uma disciplina com esse nome.")
    session.refresh(disciplina)
    return disciplina


@router.put("/disciplinas/{disciplina_id}", response_model=DisciplinaRead, dependencies=[GerenciarDisciplinas])
def atualizar_disciplina(
    disciplina_id: int, dados: DisciplinaUpdate, session: SessionDep, usuario_atual: CurrentUserDep
):
    disciplina = _get_disciplina_da_escola(session, disciplina_id, usuario_atual.escola_id)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(disciplina, campo, valor)
    session.add(disciplina)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já existe uma disciplina com esse nome.")
    session.refresh(disciplina)
    return disciplina


@router.delete("/disciplinas/{disciplina_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[GerenciarDisciplinas])
def excluir_disciplina(disciplina_id: int, session: SessionDep, usuario_atual: CurrentUserDep):
    disciplina = _get_disciplina_da_escola(session, disciplina_id, usuario_atual.escola_id)
    disciplina.ativo = False
    session.add(disciplina)
    session.commit()
