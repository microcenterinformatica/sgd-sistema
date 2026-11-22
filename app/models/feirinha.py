from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import CheckConstraint, Column, ForeignKeyConstraint, Index, String, UniqueConstraint, text
from sqlmodel import Field, SQLModel

from app.core.tempo import agora_utc


class CartaoAluno(SQLModel, table=True):
    """Cartão impresso da feirinha. O QR guarda só `VERACOIN:<token>` — nunca
    nome, matrícula ou id do aluno. Só um cartão ativo por aluno (reemissão
    desativa o anterior)."""

    __tablename__ = "cartao_aluno"
    __table_args__ = (
        ForeignKeyConstraint(["escola_id", "aluno_id"], ["aluno.escola_id", "aluno.id"], name="cartao_aluno_aluno_fkey"),
        UniqueConstraint("escola_id", "numero", name="uq_cartao_aluno_escola_numero"),
        Index(
            "uq_cartao_aluno_um_ativo_por_aluno",
            "aluno_id",
            unique=True,
            postgresql_where=text("ativo = true"),
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(foreign_key="escola.id", index=True)
    aluno_id: int = Field(index=True)
    token: str = Field(sa_column=Column(String, nullable=False, unique=True))
    # Número impresso no cartão ("Nº 0001"), sequencial por escola.
    numero: int
    ativo: bool = Field(default=True)
    criado_em: datetime = Field(default_factory=agora_utc)
    desativado_em: Optional[datetime] = None


class TipoTransacaoVeracoin(str, Enum):
    debito = "debito"
    estorno = "estorno"


class TransacaoVeracoin(SQLModel, table=True):
    """Gastos na feirinha. Os créditos NÃO ficam aqui: continuam vindo dos
    registros disciplinares (valor do Patrimônio Disciplinar). Saldo =
    pontuação do ranking − débitos + estornos. Nada é apagado: desfazer uma
    venda gera um lançamento de estorno apontando para o débito."""

    __tablename__ = "transacao_veracoin"
    __table_args__ = (
        ForeignKeyConstraint(
            ["escola_id", "aluno_id"], ["aluno.escola_id", "aluno.id"], name="transacao_veracoin_aluno_fkey"
        ),
        CheckConstraint("valor > 0", name="ck_transacao_veracoin_valor_positivo"),
        CheckConstraint(
            "(tipo = 'estorno') = (estorno_de_id IS NOT NULL)", name="ck_transacao_veracoin_estorno_referencia"
        ),
        # Um débito só pode ser estornado uma vez.
        Index("uq_transacao_veracoin_estorno_de", "estorno_de_id", unique=True),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(foreign_key="escola.id", index=True)
    aluno_id: int = Field(index=True)
    cartao_id: Optional[int] = Field(default=None, foreign_key="cartao_aluno.id")
    tipo: TipoTransacaoVeracoin = Field(sa_column=Column(String, nullable=False))
    valor: int
    descricao: Optional[str] = None
    operador_id: int = Field(foreign_key="usuario.id", index=True)
    origem: str = Field(default="feirinha")
    estorno_de_id: Optional[int] = Field(default=None, foreign_key="transacao_veracoin.id")
    chave_idempotencia: Optional[str] = Field(default=None, sa_column=Column(String, unique=True, nullable=True))
    criado_em: datetime = Field(default_factory=agora_utc, index=True)
