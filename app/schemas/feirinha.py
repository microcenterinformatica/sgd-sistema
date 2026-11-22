from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CartaoStatusAluno(BaseModel):
    aluno_id: int
    aluno_nome: str
    numero_chamada: Optional[int]
    cartao_id: Optional[int]
    numero: Optional[int]
    criado_em: Optional[datetime]


class GerarCartoesResultado(BaseModel):
    gerados: int
    ja_tinham: int


class CartaoImpressao(BaseModel):
    aluno_id: int
    aluno_nome: str
    numero: int
    token: str


class ImpressaoCartoes(BaseModel):
    escola_nome: str
    ano: int
    turma: str
    cartoes: list[CartaoImpressao]


class CartaoFeirinha(BaseModel):
    aluno_id: int
    nome: str
    turma: Optional[str]
    foto_url: Optional[str] = None
    numero: int
    token: str
    patrimonio: float
    gasto: int
    saldo: int


class DebitoCreate(BaseModel):
    token: str
    valor: int
    descricao: Optional[str] = Field(default=None, max_length=120)
    chave_idempotencia: str = Field(min_length=8, max_length=64)


class TransacaoResultado(BaseModel):
    transacao_id: int
    aluno_id: int
    aluno_nome: str
    valor: int
    saldo: int
    repetida: bool = False


class VendaRecente(BaseModel):
    transacao_id: int
    aluno_nome: str
    turma: Optional[str]
    valor: int
    descricao: Optional[str]
    criado_em: datetime
    estornado: bool
    pode_desfazer: bool


class ResumoAluno(BaseModel):
    aluno_id: int
    aluno_nome: str
    turma: Optional[str]
    compras: int
    total: int


class ResumoTurma(BaseModel):
    turma: Optional[str]
    compras: int
    total: int


class ResumoFeirinha(BaseModel):
    data: str
    total_geral: int
    compras: int
    estornadas: int
    por_turma: list[ResumoTurma]
    por_aluno: list[ResumoAluno]


class AlunoBusca(BaseModel):
    aluno_id: int
    nome: str
    turma: Optional[str]


class CompraExtrato(BaseModel):
    transacao_id: int
    criado_em: datetime
    valor: int
    descricao: Optional[str]
    operador_nome: Optional[str]
    estornado: bool


class ExtratoAluno(BaseModel):
    aluno_id: int
    nome: str
    turma: Optional[str]
    numero_cartao: Optional[int]
    acumulado: int
    gasto: int
    saldo: int
    compras: list[CompraExtrato]
