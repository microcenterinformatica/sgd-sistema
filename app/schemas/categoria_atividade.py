from typing import Optional

from pydantic import Field, model_validator
from sqlmodel import SQLModel

from app.models.categoria_atividade import TipoCategoria


class CategoriaAtividadeCreate(SQLModel):
    disciplina_id: int
    nome: str
    peso: float = Field(gt=0)
    tipo: TipoCategoria = TipoCategoria.manual
    desconto_por_ponto: Optional[float] = Field(default=None, gt=0, le=10)

    @model_validator(mode="after")
    def _validar_desconto(self):
        if self.tipo == TipoCategoria.conduta and self.desconto_por_ponto is None:
            self.desconto_por_ponto = 0.5
        if self.tipo == TipoCategoria.manual:
            self.desconto_por_ponto = None
        return self


class CategoriaAtividadeUpdate(SQLModel):
    nome: Optional[str] = None
    peso: Optional[float] = Field(default=None, gt=0)
    desconto_por_ponto: Optional[float] = Field(default=None, gt=0, le=10)


class CategoriaAtividadeRead(SQLModel):
    id: int
    disciplina_id: int
    nome: str
    peso: float
    ativo: bool
    tipo: TipoCategoria
    desconto_por_ponto: Optional[float] = None
