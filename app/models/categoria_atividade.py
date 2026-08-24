from typing import Optional

from sqlmodel import Field, SQLModel


class CategoriaAtividade(SQLModel, table=True):
    __tablename__ = "categoria_atividade"

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(index=True)
    professor_id: Optional[int] = Field(default=None, index=True)
    disciplina_id: int = Field(foreign_key="disciplina.id", index=True)
    nome: str
    peso: float
    ativo: bool = Field(default=True)
