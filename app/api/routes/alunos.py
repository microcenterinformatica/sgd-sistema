from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from app.api.deps import CurrentUserDep, SessionDep, require_roles
from app.api.routes.registros import DESCRICAO_MERITO_TURMA, DESCRICAO_REMOCAO_MERITO_TURMA
from app.core.ano_letivo import ano_letivo_atual
from app.models.aluno import Aluno
from app.models.atividade import Atividade
from app.models.disciplina import Disciplina
from app.models.escola import Escola
from app.models.lancamento import Lancamento
from app.models.matricula_turma import MatriculaTurma
from app.models.professor import Professor
from app.models.punicao import Punicao
from app.models.registro_disciplinar import RegistroDisciplinar
from app.models.registro_falta import RegistroFalta
from app.models.turma import Turma
from app.models.usuario import PapelUsuario, Usuario
from app.schemas.aluno import AlunoCreate, AlunoRead, AlunoUpdate
from app.services.pontuacao import aplicar_recuperacoes_pendentes
from app.services.relatorio_pdf import EventoRelatorio, gerar_pdf_historico_aluno
from app.services.whatsapp import gerar_link_whatsapp, montar_mensagem_relatorio

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
    alunos = session.exec(select(Aluno).where(Aluno.escola_id == usuario_atual.escola_id)).all()
    aplicar_recuperacoes_pendentes(session, alunos, usuario_atual.escola_id)
    return alunos


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
    aluno = _get_aluno_da_escola(session, aluno_id, usuario_atual.escola_id)
    aplicar_recuperacoes_pendentes(session, [aluno], usuario_atual.escola_id)
    return aluno


def _situacao_aluno(session: SessionDep, escola_id: int, pontos: int) -> str:
    punicao = session.exec(
        select(Punicao)
        .where(Punicao.escola_id == escola_id, Punicao.ativo == True, Punicao.pontuacao_minima <= pontos)  # noqa: E712
        .order_by(Punicao.pontuacao_minima.desc())
    ).first()
    return punicao.descricao if punicao else "Sem conduta"


@router.get("/{aluno_id}/relatorio-disciplinar-whatsapp")
def link_whatsapp_relatorio_disciplinar(
    aluno_id: int, session: SessionDep, usuario_atual: CurrentUserDep, dias: int = 7
):
    """Link wa.me (texto apenas, sem anexo) pra acompanhar o PDF baixado via
    /relatorio-disciplinar — o wa.me não anexa arquivo automaticamente, quem envia
    ainda precisa arrastar o PDF já baixado pra dentro da conversa."""
    aluno = _get_aluno_da_escola(session, aluno_id, usuario_atual.escola_id)
    escola = session.get(Escola, usuario_atual.escola_id)

    hoje = date.today()
    periodo_inicio = hoje - timedelta(days=max(dias, 1) - 1)

    mensagem = montar_mensagem_relatorio(
        escola_nome=escola.nome,
        aluno_nome=aluno.nome,
        periodo_inicio_str=periodo_inicio.strftime("%d/%m/%Y"),
        periodo_fim_str=hoje.strftime("%d/%m/%Y"),
    )
    return {"whatsapp_link": gerar_link_whatsapp(aluno.whatsapp_responsavel, mensagem)}


@router.get("/{aluno_id}/relatorio-disciplinar")
def gerar_relatorio_disciplinar(
    aluno_id: int, session: SessionDep, usuario_atual: CurrentUserDep, dias: int = 7
):
    """Relatório em PDF com infrações, méritos, faltas não justificadas e atividades não
    entregues do aluno num período (padrão: últimos 7 dias) — pensado para anexar
    manualmente numa mensagem semanal ao responsável via WhatsApp."""
    aluno = _get_aluno_da_escola(session, aluno_id, usuario_atual.escola_id)
    aplicar_recuperacoes_pendentes(session, [aluno], usuario_atual.escola_id)
    escola = session.get(Escola, usuario_atual.escola_id)

    hoje = date.today()
    periodo_inicio = hoje - timedelta(days=max(dias, 1) - 1)
    inicio_dt = datetime.combine(periodo_inicio, datetime.min.time())
    fim_dt = datetime.combine(hoje, datetime.max.time())

    registros = session.exec(
        select(RegistroDisciplinar).where(
            RegistroDisciplinar.aluno_id == aluno_id,
            RegistroDisciplinar.data_hora >= inicio_dt,
            RegistroDisciplinar.data_hora <= fim_dt,
            RegistroDisciplinar.descricao.not_in([DESCRICAO_MERITO_TURMA, DESCRICAO_REMOCAO_MERITO_TURMA]),
        )
    ).all()

    professores_por_id = {
        p.id: p for p in session.exec(select(Professor).where(Professor.escola_id == usuario_atual.escola_id))
    }
    usuarios_por_id = {
        u.id: u for u in session.exec(select(Usuario).where(Usuario.escola_id == usuario_atual.escola_id))
    }

    def professor_nome_de(registro: RegistroDisciplinar) -> str | None:
        if registro.professor_id is not None:
            professor = professores_por_id.get(registro.professor_id)
            return professor.nome if professor else None
        usuario = usuarios_por_id.get(registro.registrado_por_usuario_id)
        return usuario.nome if usuario else None

    eventos = [
        EventoRelatorio(
            data=r.data_hora,
            tipo=r.tipo.value,
            descricao=r.descricao,
            peso=r.peso,
            professor_nome=professor_nome_de(r),
            observacao=r.observacao,
        )
        for r in registros
    ]

    condicoes_falta = [
        RegistroFalta.aluno_id == aluno_id,
        RegistroFalta.justificada == False,  # noqa: E712
        RegistroFalta.data >= periodo_inicio,
        RegistroFalta.data <= hoje,
    ]
    faltas = session.exec(select(RegistroFalta).where(*condicoes_falta)).all()
    for f in faltas:
        eventos.append(EventoRelatorio(data=f.data, tipo="falta", descricao="Falta não justificada"))

    nao_entregas = session.exec(
        select(Lancamento, Atividade, Disciplina)
        .join(Atividade, Lancamento.atividade_id == Atividade.id)
        .join(Disciplina, Atividade.disciplina_id == Disciplina.id)
        .where(
            Lancamento.aluno_id == aluno_id,
            Atividade.escola_id == usuario_atual.escola_id,
            Atividade.ativo == True,  # noqa: E712
            Lancamento.fez == False,  # noqa: E712
        )
    ).all()
    for lancamento, atividade, disciplina in nao_entregas:
        data_evento = atividade.data_entrega or atividade.data
        if periodo_inicio <= data_evento <= hoje:
            eventos.append(
                EventoRelatorio(
                    data=data_evento,
                    tipo="nao_entrega",
                    descricao=f"Não entregou: {atividade.titulo} ({disciplina.nome})",
                )
            )

    eventos.sort(key=lambda e: e.data if isinstance(e.data, datetime) else datetime.combine(e.data, datetime.min.time()))

    situacao = _situacao_aluno(session, usuario_atual.escola_id, aluno.pontos_atuais)
    pdf_bytes = gerar_pdf_historico_aluno(escola, aluno, eventos, periodo_inicio, hoje, situacao)

    nome_arquivo = f"relatorio_{aluno.matricula}_{hoje.isoformat()}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nome_arquivo}"'},
    )


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
