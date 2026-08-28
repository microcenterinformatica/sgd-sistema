from sqlmodel import Field, SQLModel


class ConfiguracaoRecuperacao(SQLModel, table=True):
    __tablename__ = "configuracao_recuperacao"

    escola_id: int = Field(foreign_key="escola.id", primary_key=True)
    ativo: bool = Field(default=False)
    dias_para_recuperacao: int = Field(default=7)
    pontos_recuperacao: int = Field(default=2)
