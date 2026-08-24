from sqlmodel import SQLModel


class AlunoRecuperado(SQLModel):
    aluno_id: int
    nome: str
    pontos_reduzidos: int


class RecuperacaoResponse(SQLModel):
    total_alunos_recuperados: int
    total_pontos_reduzidos: int
    detalhes: list[AlunoRecuperado]
