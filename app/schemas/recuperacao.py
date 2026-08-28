from typing import Optional

from sqlmodel import SQLModel


class ConfiguracaoRecuperacaoRead(SQLModel):
    ativo: bool
    dias_para_recuperacao: int
    pontos_recuperacao: int


class ConfiguracaoRecuperacaoUpdate(SQLModel):
    ativo: Optional[bool] = None
    dias_para_recuperacao: Optional[int] = None
    pontos_recuperacao: Optional[int] = None
