from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select

from app.api.deps import SessionDep, require_roles
from app.core.security import hash_senha
from app.models.usuario import PapelUsuario, Usuario
from app.schemas.usuario import UsuarioCreate, UsuarioRead, UsuarioUpdate

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


def _get_usuario_da_escola(session: SessionDep, usuario_id: int, escola_id: int) -> Usuario:
    usuario = session.get(Usuario, usuario_id)
    if usuario is None or usuario.escola_id != escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    return usuario


@router.post("", response_model=UsuarioRead, status_code=status.HTTP_201_CREATED)
def criar_usuario(dados: UsuarioCreate, session: SessionDep, usuario_atual=Depends(require_roles(PapelUsuario.admin_escola))):
    ja_existe = session.exec(select(Usuario).where(Usuario.email == dados.email)).first()
    if ja_existe is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email já cadastrado")

    usuario = Usuario(
        escola_id=usuario_atual.escola_id,
        nome=dados.nome,
        email=dados.email,
        senha_hash=hash_senha(dados.senha),
        papel=dados.papel,
    )
    session.add(usuario)
    session.commit()
    session.refresh(usuario)
    return usuario


@router.get("", response_model=list[UsuarioRead])
def listar_usuarios(session: SessionDep, usuario_atual=Depends(require_roles(PapelUsuario.admin_escola))):
    return session.exec(select(Usuario).where(Usuario.escola_id == usuario_atual.escola_id)).all()


@router.get("/{usuario_id}", response_model=UsuarioRead)
def obter_usuario(usuario_id: int, session: SessionDep, usuario_atual=Depends(require_roles(PapelUsuario.admin_escola))):
    return _get_usuario_da_escola(session, usuario_id, usuario_atual.escola_id)


@router.put("/{usuario_id}", response_model=UsuarioRead)
def atualizar_usuario(
    usuario_id: int,
    dados: UsuarioUpdate,
    session: SessionDep,
    usuario_atual=Depends(require_roles(PapelUsuario.admin_escola)),
):
    usuario = _get_usuario_da_escola(session, usuario_id, usuario_atual.escola_id)

    if dados.ativo is False and usuario.id == usuario_atual.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Você não pode desativar seu próprio usuário")

    if dados.nome is not None:
        usuario.nome = dados.nome
    if dados.senha is not None:
        usuario.senha_hash = hash_senha(dados.senha)
    if dados.papel is not None:
        usuario.papel = dados.papel
    if dados.ativo is not None:
        usuario.ativo = dados.ativo

    session.add(usuario)
    session.commit()
    session.refresh(usuario)
    return usuario
