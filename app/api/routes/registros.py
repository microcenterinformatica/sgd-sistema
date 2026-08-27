from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select

from app.api.deps import CurrentUserDep, SessionDep, require_roles
from app.core.permissoes import verificar_permissao_turma
from app.models.aluno import Aluno
from app.models.escola import Escola
from app.models.professor import Professor
from app.models.regra_infracao import RegraInfracao
from app.models.registro_disciplinar import RegistroDisciplinar, TipoRegistro
from app.models.usuario import PapelUsuario, Usuario
from app.schemas.registro_disciplinar import (
    RegistroDisciplinarRead,
    RegistroDisciplinarResponse,
    RegistroInfracaoCreate,
    RegistroInfracaoUpdate,
    RegistroMeritoCreate,
)
from app.services.pontuacao import aplicar_infracao, aplicar_merito, recalcular_apos_edicao
from app.services.whatsapp import gerar_link_whatsapp, montar_mensagem_infracao, montar_mensagem_merito

router = APIRouter(prefix="/registros", tags=["registros"])

GESTAO_ROLES = (PapelUsuario.admin_escola, PapelUsuario.coordenacao)


def _get_aluno_da_escola(session: SessionDep, aluno_id: int, escola_id: int) -> Aluno:
    aluno = session.get(Aluno, aluno_id)
    if aluno is None or aluno.escola_id != escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aluno não encontrado")
    return aluno


def _get_regra_da_escola(session: SessionDep, regra_id: int, escola_id: int) -> RegraInfracao:
    regra = session.get(RegraInfracao, regra_id)
    if regra is None or regra.escola_id != escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Regra não encontrada")
    return regra


def _get_professor_nome(session: SessionDep, professor_id: int | None, escola_id: int, fallback: str) -> str:
    if professor_id is None:
        return fallback
    professor = session.get(Professor, professor_id)
    if professor is None or professor.escola_id != escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Professor não encontrado")
    return professor.nome


def _get_registro_da_escola(session: SessionDep, registro_id: int, escola_id: int) -> RegistroDisciplinar:
    registro = session.get(RegistroDisciplinar, registro_id)
    if registro is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro não encontrado")
    aluno = session.get(Aluno, registro.aluno_id)
    if aluno is None or aluno.escola_id != escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro não encontrado")
    return registro


def _montar_read(registro: RegistroDisciplinar, professor_nome: Optional[str]) -> RegistroDisciplinarRead:
    return RegistroDisciplinarRead(**registro.model_dump(), professor_nome=professor_nome)


@router.post("/infracao", response_model=RegistroDisciplinarResponse, status_code=status.HTTP_201_CREATED)
def registrar_infracao(dados: RegistroInfracaoCreate, session: SessionDep, usuario_atual: CurrentUserDep):
    aluno = _get_aluno_da_escola(session, dados.aluno_id, usuario_atual.escola_id)
    verificar_permissao_turma(session, usuario_atual, aluno.turma)
    regra = _get_regra_da_escola(session, dados.regra_id, usuario_atual.escola_id)
    professor_nome = _get_professor_nome(session, dados.professor_id, usuario_atual.escola_id, usuario_atual.nome)
    escola = session.get(Escola, usuario_atual.escola_id)
    agora = datetime.now(timezone.utc).replace(tzinfo=None)

    registro = RegistroDisciplinar(
        aluno_id=aluno.id,
        tipo=TipoRegistro.infracao,
        regra_id=regra.id,
        descricao=regra.descricao,
        peso=regra.peso,
        data_hora=agora,
        observacao=dados.observacao,
        professor_id=dados.professor_id,
        registrado_por_usuario_id=usuario_atual.id,
    )
    aplicar_infracao(aluno, regra.peso, agora)

    session.add(registro)
    session.add(aluno)
    session.commit()
    session.refresh(registro)
    session.refresh(aluno)

    mensagem = montar_mensagem_infracao(
        escola_nome=escola.nome,
        aluno_nome=aluno.nome,
        descricao_infracao=regra.descricao,
        peso=regra.peso,
        professor_nome=professor_nome,
        observacao=dados.observacao or "",
        data_hora_str=agora.strftime("%d/%m/%Y %H:%M"),
        pontos_atuais=aluno.pontos_atuais,
    )

    return RegistroDisciplinarResponse(
        registro=_montar_read(registro, professor_nome),
        pontos_atuais=aluno.pontos_atuais,
        whatsapp_link=gerar_link_whatsapp(aluno.whatsapp_responsavel, mensagem),
    )


@router.post("/merito", response_model=RegistroDisciplinarResponse, status_code=status.HTTP_201_CREATED)
def registrar_merito(dados: RegistroMeritoCreate, session: SessionDep, usuario_atual: CurrentUserDep):
    if dados.pontos_bonus <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="pontos_bonus deve ser positivo")

    aluno = _get_aluno_da_escola(session, dados.aluno_id, usuario_atual.escola_id)
    verificar_permissao_turma(session, usuario_atual, aluno.turma)
    professor_nome = _get_professor_nome(session, dados.professor_id, usuario_atual.escola_id, usuario_atual.nome)
    escola = session.get(Escola, usuario_atual.escola_id)
    agora = datetime.now(timezone.utc).replace(tzinfo=None)

    registro = RegistroDisciplinar(
        aluno_id=aluno.id,
        tipo=TipoRegistro.merito,
        regra_id=None,
        descricao="PONTO DE MÉRITO/BÔNUS",
        peso=-dados.pontos_bonus,
        data_hora=agora,
        observacao=dados.observacao,
        professor_id=dados.professor_id,
        registrado_por_usuario_id=usuario_atual.id,
    )
    aplicar_merito(aluno, dados.pontos_bonus)

    session.add(registro)
    session.add(aluno)
    session.commit()
    session.refresh(registro)
    session.refresh(aluno)

    mensagem = montar_mensagem_merito(
        escola_nome=escola.nome,
        aluno_nome=aluno.nome,
        pontos_bonus=dados.pontos_bonus,
        professor_nome=professor_nome,
        observacao=dados.observacao or "",
        data_hora_str=agora.strftime("%d/%m/%Y %H:%M"),
        pontos_atuais=aluno.pontos_atuais,
    )

    return RegistroDisciplinarResponse(
        registro=_montar_read(registro, professor_nome),
        pontos_atuais=aluno.pontos_atuais,
        whatsapp_link=gerar_link_whatsapp(aluno.whatsapp_responsavel, mensagem),
    )


@router.put("/{registro_id}", response_model=RegistroDisciplinarResponse)
def editar_registro_infracao(
    registro_id: int, dados: RegistroInfracaoUpdate, session: SessionDep, usuario_atual: CurrentUserDep
):
    registro = _get_registro_da_escola(session, registro_id, usuario_atual.escola_id)
    if registro.tipo != TipoRegistro.infracao:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Apenas registros de infração podem ser editados")

    aluno = session.get(Aluno, registro.aluno_id)
    verificar_permissao_turma(session, usuario_atual, aluno.turma)
    regra = _get_regra_da_escola(session, dados.regra_id, usuario_atual.escola_id)
    agora = datetime.now(timezone.utc).replace(tzinfo=None)

    peso_antigo = registro.peso
    recalcular_apos_edicao(aluno, peso_antigo, regra.peso)

    registro.regra_id = regra.id
    registro.descricao = regra.descricao
    registro.peso = regra.peso
    registro.observacao = dados.observacao
    registro.professor_id = dados.professor_id
    registro.data_hora = agora
    aluno.data_ultima_infracao = agora

    professor_nome = _get_professor_nome(session, dados.professor_id, usuario_atual.escola_id, usuario_atual.nome)

    session.add(registro)
    session.add(aluno)
    session.commit()
    session.refresh(registro)
    session.refresh(aluno)

    return RegistroDisciplinarResponse(
        registro=_montar_read(registro, professor_nome),
        pontos_atuais=aluno.pontos_atuais,
        whatsapp_link=None,
    )


@router.delete("/{registro_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_registro(
    registro_id: int,
    session: SessionDep,
    usuario_atual=Depends(require_roles(*GESTAO_ROLES)),
):
    registro = _get_registro_da_escola(session, registro_id, usuario_atual.escola_id)
    aluno = session.get(Aluno, registro.aluno_id)

    recalcular_apos_edicao(aluno, registro.peso, 0)

    session.delete(registro)
    session.add(aluno)
    session.commit()


@router.get("", response_model=list[RegistroDisciplinarRead])
def listar_registros(session: SessionDep, usuario_atual: CurrentUserDep, aluno_id: int | None = None):
    query = select(RegistroDisciplinar).join(Aluno).where(Aluno.escola_id == usuario_atual.escola_id)
    if aluno_id is not None:
        query = query.where(RegistroDisciplinar.aluno_id == aluno_id)
    query = query.order_by(RegistroDisciplinar.data_hora.desc())
    registros = session.exec(query).all()

    professores_por_id = {
        p.id: p for p in session.exec(select(Professor).where(Professor.escola_id == usuario_atual.escola_id))
    }
    usuarios_por_id = {
        u.id: u for u in session.exec(select(Usuario).where(Usuario.escola_id == usuario_atual.escola_id))
    }

    def professor_nome_de(registro: RegistroDisciplinar) -> Optional[str]:
        if registro.professor_id is not None:
            professor = professores_por_id.get(registro.professor_id)
            return professor.nome if professor else None
        usuario = usuarios_por_id.get(registro.registrado_por_usuario_id)
        return usuario.nome if usuario else None

    return [_montar_read(r, professor_nome_de(r)) for r in registros]
