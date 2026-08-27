from typing import Optional

from sqlmodel import SQLModel


class RankingItem(SQLModel):
    aluno_id: int
    aluno_nome: str
    turma: Optional[str]
    total_merito: int
    total_infracao: int
    faltas_nao_justificadas: int
    atividades_nao_entregues: int
    pontuacao: float


class ConfiguracaoRankingRead(SQLModel):
    peso_falta: float
    peso_nao_entrega: float


class ConfiguracaoRankingUpdate(SQLModel):
    peso_falta: Optional[float] = None
    peso_nao_entrega: Optional[float] = None
