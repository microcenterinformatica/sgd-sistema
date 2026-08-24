from typing import Optional

from sqlmodel import Field, SQLModel


class Professor(SQLModel, table=True):
    __tablename__ = "professor"

    id: Optional[int] = Field(default=None, primary_key=True)
    escola_id: int = Field(foreign_key="escola.id", index=True)
    nome: str
    usuario_id: Optional[int] = Field(default=None, foreign_key="usuario.id")
