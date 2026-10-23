from enum import Enum
from typing import Optional

from sqlalchemy import CheckConstraint, ForeignKeyConstraint
from sqlmodel import Field, SQLModel


class TipoCategoria(str, Enum):
    manual = "manual"
    # Nota calculada sozinha pela conduta do aluno no período (sem atividades lançadas).
    conduta = "conduta"


class CategoriaAtividade(SQLModel, table=True):
    __tablename__ = "categoria_atividade"
    __table_args__ = (
        CheckConstraint("peso > 0", name="ck_categoria_atividade_peso"),
        CheckConstraint(
            "desconto_por_ponto IS NULL OR desconto_por_ponto > 0",
            name="ck_categoria_atividade_desconto_por_ponto",
        ),
        ForeignKeyConstraint(
            ["escola_id", "disciplina_id"], ["disciplina.escola_id", "disciplina.id"],
            name="categoria_atividade_disciplina_composta_fkey",
        ),
        ForeignKeyConstraint(
            ["escola_id", "professor_id"], ["professor.escola_id", "professor.id"],
            name="categoria_atividade_professor_composta_fkey",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(foreign_key="escola.id", index=True)
    professor_id: Optional[int] = Field(default=None, index=True)
    disciplina_id: int = Field(index=True)
    nome: str
    peso: float = Field(gt=0)
    ativo: bool = Field(default=True)
    tipo: TipoCategoria = Field(default=TipoCategoria.manual)
    # Só para tipo=conduta: quanto da nota (0-10) cada ponto de indisciplina desconta.
    desconto_por_ponto: Optional[float] = Field(default=None)
