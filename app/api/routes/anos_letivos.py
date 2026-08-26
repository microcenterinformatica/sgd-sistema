from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from app.api.deps import CurrentUserDep, SessionDep, require_roles
from app.models.ano_letivo import AnoLetivo
from app.schemas.ano_letivo import AnoLetivoCreate, AnoLetivoRead, AnoLetivoUpdate

router = APIRouter(tags=["anos-letivos"])

GerenciarAnosLetivos = Depends(require_roles("admin_escola", "coordenacao"))


def _get_ano_letivo_da_escola(session: SessionDep, ano_letivo_id: int, escola_id: int) -> AnoLetivo:
    ano_letivo = session.get(AnoLetivo, ano_letivo_id)
    if ano_letivo is None or ano_letivo.escola_id != escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ano letivo não encontrado")
    return ano_letivo


@router.get("/anos-letivos", response_model=list[AnoLetivoRead])
def listar_anos_letivos(session: SessionDep, usuario_atual: CurrentUserDep):
    query = select(AnoLetivo).where(AnoLetivo.escola_id == usuario_atual.escola_id).order_by(AnoLetivo.ano.desc())
    return session.exec(query).all()


@router.post(
    "/anos-letivos", response_model=AnoLetivoRead, status_code=status.HTTP_201_CREATED,
    dependencies=[GerenciarAnosLetivos],
)
def criar_ano_letivo(dados: AnoLetivoCreate, session: SessionDep, usuario_atual: CurrentUserDep):
    if dados.situacao == "aberto":
        for outro in session.exec(
            select(AnoLetivo).where(
                AnoLetivo.escola_id == usuario_atual.escola_id, AnoLetivo.situacao == "aberto"
            )
        ).all():
            outro.situacao = "encerrado"
            session.add(outro)

    ano_letivo = AnoLetivo(escola_id=usuario_atual.escola_id, **dados.model_dump())
    session.add(ano_letivo)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já existe um ano letivo com esse ano.")
    session.refresh(ano_letivo)
    return ano_letivo


@router.put("/anos-letivos/{ano_letivo_id}", response_model=AnoLetivoRead, dependencies=[GerenciarAnosLetivos])
def atualizar_ano_letivo(
    ano_letivo_id: int, dados: AnoLetivoUpdate, session: SessionDep, usuario_atual: CurrentUserDep
):
    ano_letivo = _get_ano_letivo_da_escola(session, ano_letivo_id, usuario_atual.escola_id)
    campos = dados.model_dump(exclude_unset=True)

    if campos.get("situacao") == "aberto":
        for outro in session.exec(
            select(AnoLetivo).where(
                AnoLetivo.escola_id == usuario_atual.escola_id,
                AnoLetivo.situacao == "aberto",
                AnoLetivo.id != ano_letivo.id,
            )
        ).all():
            outro.situacao = "encerrado"
            session.add(outro)

    for campo, valor in campos.items():
        setattr(ano_letivo, campo, valor)
    session.add(ano_letivo)
    session.commit()
    session.refresh(ano_letivo)
    return ano_letivo
