from datetime import date

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import func, select

from app.api.deps import CurrentUserDep, SessionDep
from app.core.permissoes import buscar_professor_do_usuario, verificar_permissao_turma_disciplina
from app.models.aluno import Aluno
from app.models.atividade import Atividade
from app.models.categoria_atividade import CategoriaAtividade
from app.models.disciplina import Disciplina
from app.models.lancamento import Lancamento
from app.models.turma import Turma
from app.models.atividade import TipoAtividade
from app.schemas.atividade import (
    AtividadeCreate,
    AtividadeNaoEntregueRead,
    AtividadeRead,
    AtividadeResumoItem,
    AtividadeUpdate,
)
from app.schemas.lancamento import LancamentoAlunoRead, LancamentoLoteCreate, LancamentoRead

router = APIRouter(tags=["atividades"])


def _listar_alunos_por_turma(session: SessionDep, escola_id: int, turma: str | None) -> list[Aluno]:
    query = select(Aluno).where(Aluno.escola_id == escola_id)
    if turma:
        query = query.where(Aluno.turma == turma)
    query = query.order_by(Aluno.numero_chamada.is_(None), Aluno.numero_chamada, Aluno.nome)
    return session.exec(query).all()


def _listar_turmas(session: SessionDep, escola_id: int) -> list[str]:
    return session.exec(
        select(Turma.nome)
        .where(Turma.escola_id == escola_id, Turma.ativo == True)  # noqa: E712
        .order_by(Turma.nome)
    ).all()


def _get_atividade_da_escola(session: SessionDep, atividade_id: int, escola_id: int) -> Atividade:
    atividade = session.get(Atividade, atividade_id)
    if atividade is None or atividade.escola_id != escola_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Atividade não encontrada")
    return atividade


def _montar_atividade_read(
    atividade: Atividade, categoria: CategoriaAtividade, total_lancamentos: int = 0
) -> AtividadeRead:
    return AtividadeRead(
        id=atividade.id,
        escola_id=atividade.escola_id,
        professor_id=atividade.professor_id,
        disciplina_id=atividade.disciplina_id,
        turma=atividade.turma,
        titulo=atividade.titulo,
        tipo=atividade.tipo,
        categoria_id=atividade.categoria_id,
        categoria_nome=categoria.nome,
        categoria_peso=categoria.peso,
        data=atividade.data,
        data_entrega=atividade.data_entrega,
        ativo=atividade.ativo,
        total_lancamentos=total_lancamentos,
    )


def _contar_lancamentos(session: SessionDep, atividade_id: int) -> int:
    return session.exec(
        select(func.count()).where(Lancamento.atividade_id == atividade_id)
    ).one()


def _get_categoria_valida(
    session: SessionDep, categoria_id: int, escola_id: int, disciplina_id: int
) -> CategoriaAtividade:
    categoria = session.get(CategoriaAtividade, categoria_id)
    if (
        categoria is None
        or categoria.escola_id != escola_id
        or categoria.disciplina_id != disciplina_id
        or not categoria.ativo
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Categoria inválida para esta disciplina"
        )
    return categoria


@router.post("/atividades", response_model=AtividadeRead, status_code=status.HTTP_201_CREATED)
def criar_atividade(dados: AtividadeCreate, session: SessionDep, usuario_atual: CurrentUserDep):
    verificar_permissao_turma_disciplina(session, usuario_atual, dados.turma, dados.disciplina_id)
    categoria = _get_categoria_valida(session, dados.categoria_id, usuario_atual.escola_id, dados.disciplina_id)

    dados_dict = dados.model_dump()
    if usuario_atual.papel == "professor":
        professor = buscar_professor_do_usuario(session, usuario_atual)
        dados_dict["professor_id"] = professor.id if professor else None

    atividade = Atividade(escola_id=usuario_atual.escola_id, **dados_dict)
    session.add(atividade)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Turma '{dados.turma}' não encontrada."
        )
    session.refresh(atividade)
    return _montar_atividade_read(atividade, categoria)


@router.put("/atividades/{atividade_id}", response_model=AtividadeRead)
def atualizar_atividade(
    atividade_id: int, dados: AtividadeUpdate, session: SessionDep, usuario_atual: CurrentUserDep
):
    atividade = _get_atividade_da_escola(session, atividade_id, usuario_atual.escola_id)
    dados_dict = dados.model_dump(exclude_unset=True)
    if "categoria_id" in dados_dict:
        _get_categoria_valida(session, dados_dict["categoria_id"], usuario_atual.escola_id, atividade.disciplina_id)
    for campo, valor in dados_dict.items():
        setattr(atividade, campo, valor)
    if atividade.data_entrega is not None and atividade.data_entrega < atividade.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Data de entrega não pode ser anterior à data da atividade",
        )
    session.add(atividade)
    session.commit()
    session.refresh(atividade)
    categoria = session.get(CategoriaAtividade, atividade.categoria_id)
    return _montar_atividade_read(atividade, categoria, _contar_lancamentos(session, atividade.id))


@router.delete("/atividades/{atividade_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_atividade(atividade_id: int, session: SessionDep, usuario_atual: CurrentUserDep):
    atividade = _get_atividade_da_escola(session, atividade_id, usuario_atual.escola_id)
    atividade.ativo = False
    session.add(atividade)
    session.commit()


@router.get("/atividades", response_model=list[AtividadeRead])
def listar_atividades(
    session: SessionDep,
    usuario_atual: CurrentUserDep,
    turma: str | None = None,
    disciplina_id: int | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
):
    query = (
        select(Atividade, CategoriaAtividade)
        .join(CategoriaAtividade, Atividade.categoria_id == CategoriaAtividade.id)
        .where(Atividade.escola_id == usuario_atual.escola_id, Atividade.ativo == True)  # noqa: E712
    )
    if turma:
        query = query.where(Atividade.turma == turma)
    if disciplina_id:
        query = query.where(Atividade.disciplina_id == disciplina_id)
    if data_inicio:
        query = query.where(Atividade.data_entrega >= data_inicio)
    if data_fim:
        query = query.where(Atividade.data_entrega <= data_fim)
    query = query.order_by(Atividade.data.desc())
    linhas = session.exec(query).all()

    atividade_ids = [atividade.id for atividade, _ in linhas]
    contagens: dict[int, int] = {}
    if atividade_ids:
        for atividade_id, total in session.exec(
            select(Lancamento.atividade_id, func.count())
            .where(Lancamento.atividade_id.in_(atividade_ids))
            .group_by(Lancamento.atividade_id)
        ).all():
            contagens[atividade_id] = total

    return [
        _montar_atividade_read(atividade, categoria, contagens.get(atividade.id, 0))
        for atividade, categoria in linhas
    ]


@router.get("/turmas", response_model=list[str])
def listar_turmas_da_escola(session: SessionDep, usuario_atual: CurrentUserDep):
    return _listar_turmas(session, usuario_atual.escola_id)


@router.get("/atividades/nao-entregues", response_model=list[AtividadeNaoEntregueRead])
def listar_nao_entregues(session: SessionDep, usuario_atual: CurrentUserDep):
    linhas = session.exec(
        select(Lancamento, Atividade, Disciplina)
        .join(Atividade, Lancamento.atividade_id == Atividade.id)
        .join(Disciplina, Atividade.disciplina_id == Disciplina.id)
        .where(Atividade.escola_id == usuario_atual.escola_id, Lancamento.fez == False)  # noqa: E712
    ).all()
    return [
        AtividadeNaoEntregueRead(
            aluno_id=lancamento.aluno_id,
            atividade_titulo=atividade.titulo,
            disciplina_nome=disciplina.nome,
            tipo=atividade.tipo,
            data=atividade.data_entrega or atividade.data,
        )
        for lancamento, atividade, disciplina in linhas
    ]


@router.get("/atividades/resumo", response_model=list[AtividadeResumoItem])
def resumo_atividades_por_turma(
    turma: str, disciplina_id: int, session: SessionDep, usuario_atual: CurrentUserDep
):
    """Percentual de atividades (trabalho/atividade/tarefa) que cada aluno da turma concluiu numa disciplina."""
    atividades = session.exec(
        select(Atividade).where(
            Atividade.escola_id == usuario_atual.escola_id,
            Atividade.turma == turma,
            Atividade.disciplina_id == disciplina_id,
            Atividade.ativo == True,  # noqa: E712
            Atividade.tipo != TipoAtividade.prova,
        )
    ).all()
    total_atividades = len(atividades)
    atividade_ids = {a.id for a in atividades}

    alunos = _listar_alunos_por_turma(session, usuario_atual.escola_id, turma)

    if total_atividades == 0:
        return [
            AtividadeResumoItem(aluno_id=a.id, aluno_nome=a.nome, total_atividades=0, total_fez=0, percentual=0.0)
            for a in alunos
        ]

    lancamentos = session.exec(
        select(Lancamento).where(Lancamento.atividade_id.in_(atividade_ids), Lancamento.fez == True)  # noqa: E712
    ).all()

    fez_por_aluno: dict[int, int] = {}
    for l in lancamentos:
        fez_por_aluno[l.aluno_id] = fez_por_aluno.get(l.aluno_id, 0) + 1

    resultado = [
        AtividadeResumoItem(
            aluno_id=a.id,
            aluno_nome=a.nome,
            total_atividades=total_atividades,
            total_fez=fez_por_aluno.get(a.id, 0),
            percentual=round(100 * fez_por_aluno.get(a.id, 0) / total_atividades, 1),
        )
        for a in alunos
    ]
    return sorted(resultado, key=lambda r: r.percentual, reverse=True)


@router.get("/atividades/{atividade_id}/alunos-turma")
def listar_alunos_da_turma_atividade(atividade_id: int, session: SessionDep, usuario_atual: CurrentUserDep):
    atividade = _get_atividade_da_escola(session, atividade_id, usuario_atual.escola_id)
    alunos = _listar_alunos_por_turma(session, usuario_atual.escola_id, atividade.turma)
    return [
        {"id": a.id, "nome": a.nome, "matricula": a.matricula, "turma": a.turma, "numero_chamada": a.numero_chamada}
        for a in alunos
    ]


@router.post("/atividades/{atividade_id}/lancamentos/lote", response_model=list[LancamentoRead])
def lancar_em_lote(
    atividade_id: int, dados: LancamentoLoteCreate, session: SessionDep, usuario_atual: CurrentUserDep
):
    atividade = _get_atividade_da_escola(session, atividade_id, usuario_atual.escola_id)

    resultado: list[Lancamento] = []
    for item in dados.itens:
        no_prazo = None
        if item.entregue_em is not None and atividade.data_entrega is not None:
            no_prazo = item.entregue_em <= atividade.data_entrega

        nota = item.nota
        if nota is None and item.fez and atividade.tipo != TipoAtividade.prova:
            nota = 10.0

        existente = session.exec(
            select(Lancamento).where(
                Lancamento.atividade_id == atividade.id, Lancamento.aluno_id == item.aluno_id
            )
        ).first()

        if existente is not None:
            existente.nota = nota
            existente.fez = item.fez
            existente.entregue_em = item.entregue_em
            existente.no_prazo = no_prazo
            existente.observacao = item.observacao
            session.add(existente)
            resultado.append(existente)
        else:
            novo = Lancamento(
                atividade_id=atividade.id,
                aluno_id=item.aluno_id,
                nota=nota,
                fez=item.fez,
                entregue_em=item.entregue_em,
                no_prazo=no_prazo,
                observacao=item.observacao,
            )
            session.add(novo)
            resultado.append(novo)

    session.commit()
    for lancamento in resultado:
        session.refresh(lancamento)
    return resultado


@router.get("/atividades/{atividade_id}/lancamentos", response_model=list[LancamentoRead])
def listar_lancamentos_da_atividade(atividade_id: int, session: SessionDep, usuario_atual: CurrentUserDep):
    atividade = _get_atividade_da_escola(session, atividade_id, usuario_atual.escola_id)
    lancamentos = session.exec(select(Lancamento).where(Lancamento.atividade_id == atividade.id)).all()

    alunos = _listar_alunos_por_turma(session, usuario_atual.escola_id, atividade.turma)
    nomes_por_id = {a.id: a.nome for a in alunos}

    return [
        LancamentoRead(**l.model_dump(), aluno_nome=nomes_por_id.get(l.aluno_id)) for l in lancamentos
    ]


@router.get("/alunos/{aluno_id}/lancamentos", response_model=list[LancamentoAlunoRead])
def listar_lancamentos_do_aluno(
    aluno_id: int,
    session: SessionDep,
    usuario_atual: CurrentUserDep,
    disciplina_id: int | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
):
    query = (
        select(Lancamento, Atividade, Disciplina)
        .join(Atividade, Lancamento.atividade_id == Atividade.id)
        .join(Disciplina, Atividade.disciplina_id == Disciplina.id)
        .where(Lancamento.aluno_id == aluno_id, Atividade.escola_id == usuario_atual.escola_id)
    )
    if disciplina_id:
        query = query.where(Atividade.disciplina_id == disciplina_id)
    if data_inicio:
        query = query.where(Atividade.data_entrega >= data_inicio)
    if data_fim:
        query = query.where(Atividade.data_entrega <= data_fim)
    query = query.order_by(Atividade.data_entrega.desc(), Atividade.data.desc())
    linhas = session.exec(query).all()
    return [
        LancamentoAlunoRead(
            id=lancamento.id,
            atividade_id=atividade.id,
            atividade_titulo=atividade.titulo,
            atividade_tipo=atividade.tipo,
            atividade_turma=atividade.turma,
            disciplina_id=disciplina.id,
            disciplina_nome=disciplina.nome,
            atividade_data=atividade.data,
            atividade_data_entrega=atividade.data_entrega,
            nota=lancamento.nota,
            fez=lancamento.fez,
            entregue_em=lancamento.entregue_em,
            no_prazo=lancamento.no_prazo,
            observacao=lancamento.observacao,
        )
        for lancamento, atividade, disciplina in linhas
    ]
