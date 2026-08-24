from sqlmodel import SQLModel


class AtribuicaoCreate(SQLModel):
    professor_id: int
    disciplina_id: int
    turma: str


class AtribuicaoRead(SQLModel):
    id: int
    professor_id: int
    professor_nome: str
    disciplina_id: int
    disciplina_nome: str
    turma: str


class TurmaDisciplinaPermitida(SQLModel):
    turma: str
    disciplina_id: int
    disciplina_nome: str


class MinhasAtribuicoesRead(SQLModel):
    acesso_total: bool
    combinacoes: list[TurmaDisciplinaPermitida]
