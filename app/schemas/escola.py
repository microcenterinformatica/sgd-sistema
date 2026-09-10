from typing import Optional

from sqlmodel import SQLModel


class EscolaRead(SQLModel):
    nome: str


class EscolaUpdate(SQLModel):
    nome: Optional[str] = None
