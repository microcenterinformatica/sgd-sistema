from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func
from sqlmodel import select

from app.api.deps import CurrentUserDep, SessionDep
from app.core.permissoes import buscar_professor_do_usuario, verificar_permissao_disciplina
from app.models.categoria_atividade import CategoriaAtividade
from app.schemas.categoria_atividade import (
    CategoriaAtividadeCreate,
    CategoriaAtividadeRead,
    CategoriaAtividadeUpdate,
)

router = APIRouter(tags=["categorias"])


def _get_categoria_do_professor(
    session: SessionDep, categoria_id: int, escola_id: int, professor_id: int
) -> CategoriaAtividade:
    categoria = session.get(CategoriaAtividade, categoria_id)
    if (
        categoria is None
        or categoria.escola_id != escola_id
        or categoria.professor_id != professor_id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoria não encontrada")
    return categoria


@router.get("/categorias-atividade", response_model=list[CategoriaAtividadeRead])
def listar_categorias(disciplina_id: int, session: SessionDep, usuario_atual: CurrentUserDep):
    verificar_permissao_disciplina(session, usuario_atual, disciplina_id)
    professor = buscar_professor_do_usuario(session, usuario_atual)
    if professor is None:
        return []

    query = (
        select(CategoriaAtividade)
        .where(
            CategoriaAtividade.escola_id == usuario_atual.escola_id,
            CategoriaAtividade.professor_id == professor.id,
            CategoriaAtividade.disciplina_id == disciplina_id,
            CategoriaAtividade.ativo == True,  # noqa: E712
        )
        .order_by(CategoriaAtividade.nome)
    )
    return session.exec(query).all()


@router.post("/categorias-atividade", response_model=CategoriaAtividadeRead, status_code=status.HTTP_201_CREATED)
def criar_categoria(dados: CategoriaAtividadeCreate, session: SessionDep, usuario_atual: CurrentUserDep):
    verificar_permissao_disciplina(session, usuario_atual, dados.disciplina_id)
    professor = buscar_professor_do_usuario(session, usuario_atual)
    if professor is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Somente professores podem cadastrar categorias de atividade.",
        )

    nome = dados.nome.strip()
    existente = session.exec(
        select(CategoriaAtividade).where(
            CategoriaAtividade.escola_id == usuario_atual.escola_id,
            CategoriaAtividade.professor_id == professor.id,
            CategoriaAtividade.disciplina_id == dados.disciplina_id,
            CategoriaAtividade.ativo == True,  # noqa: E712
            func.lower(CategoriaAtividade.nome) == nome.lower(),
        )
    ).first()
    if existente is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Você já tem uma categoria com esse nome nesta disciplina.",
        )

    categoria = CategoriaAtividade(
        escola_id=usuario_atual.escola_id,
        professor_id=professor.id,
        disciplina_id=dados.disciplina_id,
        nome=nome,
        peso=dados.peso,
    )
    session.add(categoria)
    session.commit()
    session.refresh(categoria)
    return categoria


@router.put("/categorias-atividade/{categoria_id}", response_model=CategoriaAtividadeRead)
def atualizar_categoria(
    categoria_id: int, dados: CategoriaAtividadeUpdate, session: SessionDep, usuario_atual: CurrentUserDep
):
    professor = buscar_professor_do_usuario(session, usuario_atual)
    if professor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoria não encontrada")
    categoria = _get_categoria_do_professor(session, categoria_id, usuario_atual.escola_id, professor.id)

    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(categoria, campo, valor)
    session.add(categoria)
    session.commit()
    session.refresh(categoria)
    return categoria


@router.delete("/categorias-atividade/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_categoria(categoria_id: int, session: SessionDep, usuario_atual: CurrentUserDep):
    professor = buscar_professor_do_usuario(session, usuario_atual)
    if professor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoria não encontrada")
    categoria = _get_categoria_do_professor(session, categoria_id, usuario_atual.escola_id, professor.id)
    categoria.ativo = False
    session.add(categoria)
    session.commit()
