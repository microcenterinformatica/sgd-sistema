from sqlmodel import Field, SQLModel


class ConfiguracaoRanking(SQLModel, table=True):
    __tablename__ = "configuracao_ranking"

    escola_id: int = Field(foreign_key="escola.id", primary_key=True)
    peso_falta: float = Field(default=1.0)
    peso_nao_entrega: float = Field(default=0.0)
