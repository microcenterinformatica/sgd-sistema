from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from app.api.deps import CurrentUserDep, SessionDep, require_roles
from app.models.turma import Turma
from app.schemas.turma import TurmaCreate, TurmaRead, TurmaUpdate

router = APIRouter(tags=["turmas"])

GerenciarTurmas = Depends(require_roles("admin_escola", "coordenacao"))


def _get_turma_da_escola(session: SessionDep, turma_id: int, escola_id: int) -> Turma:
    turma = session.get(Turma, turma_id)
    if turma is None or turma.escola_id != escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Turma não encontrada")
    return turma


@router.get("/turmas-cadastro", response_model=list[TurmaRead])
def listar_turmas_cadastro(session: SessionDep, usuario_atual: CurrentUserDep):
    query = (
        select(Turma)
        .where(Turma.escola_id == usuario_atual.escola_id, Turma.ativo == True)  # noqa: E712
        .order_by(Turma.nome)
    )
    return session.exec(query).all()


@router.post(
    "/turmas-cadastro", response_model=TurmaRead, status_code=status.HTTP_201_CREATED, dependencies=[GerenciarTurmas]
)
def criar_turma(dados: TurmaCreate, session: SessionDep, usuario_atual: CurrentUserDep):
    turma = Turma(escola_id=usuario_atual.escola_id, nome=dados.nome.strip(), segmento=dados.segmento)
    session.add(turma)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já existe uma turma com esse nome.")
    session.refresh(turma)
    return turma


@router.put("/turmas-cadastro/{turma_id}", response_model=TurmaRead, dependencies=[GerenciarTurmas])
def atualizar_turma(turma_id: int, dados: TurmaUpdate, session: SessionDep, usuario_atual: CurrentUserDep):
    turma = _get_turma_da_escola(session, turma_id, usuario_atual.escola_id)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(turma, campo, valor.strip() if isinstance(valor, str) else valor)
    session.add(turma)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já existe uma turma com esse nome.")
    session.refresh(turma)
    return turma


@router.delete("/turmas-cadastro/{turma_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[GerenciarTurmas])
def excluir_turma(turma_id: int, session: SessionDep, usuario_atual: CurrentUserDep):
    turma = _get_turma_da_escola(session, turma_id, usuario_atual.escola_id)
    turma.ativo = False
    session.add(turma)
    session.commit()
