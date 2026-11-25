from datetime import date
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


class ExtratoPontuacaoItem(SQLModel):
    data: date
    descricao: str
    observacao: Optional[str] = None
    professor_nome: Optional[str] = None
    # Quanto o lançamento soma (+) ou desconta (−) na pontuação.
    valor: float


class ExtratoPontuacao(RankingItem):
    escola_nome: str
    matricula: str
    nome_moeda: str
    peso_falta: float
    peso_nao_entrega: float
    meritos: list[ExtratoPontuacaoItem]
    ocorrencias: list[ExtratoPontuacaoItem]
    faltas: list[ExtratoPontuacaoItem]
    nao_entregues: list[ExtratoPontuacaoItem]


class ConfiguracaoRankingRead(SQLModel):
    peso_falta: float
    peso_nao_entrega: float
    valor_veracom_base: float
    nome_moeda: str


class ConfiguracaoRankingUpdate(SQLModel):
    peso_falta: Optional[float] = None
    peso_nao_entrega: Optional[float] = None
    valor_veracom_base: Optional[float] = None
    nome_moeda: Optional[str] = None
