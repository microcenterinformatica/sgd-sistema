from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    alunos,
    atividades,
    atribuicoes,
    auth,
    boletim,
    categorias,
    configuracao_periodo,
    disciplinas,
    faltas,
    professores,
    punicoes,
    ranking,
    recuperacao,
    regras,
    registros,
    turmas,
    usuarios,
)
from app.core.config import settings

app = FastAPI(title="SGD - Sistema de Gestão Escolar")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(usuarios.router)
app.include_router(alunos.router)
app.include_router(regras.router)
app.include_router(punicoes.router)
app.include_router(professores.router)
app.include_router(registros.router)
app.include_router(recuperacao.router)
app.include_router(disciplinas.router)
app.include_router(turmas.router)
app.include_router(configuracao_periodo.router)
app.include_router(atribuicoes.router)
app.include_router(categorias.router)
app.include_router(atividades.router)
app.include_router(faltas.router)
app.include_router(boletim.router)
app.include_router(ranking.router)


@app.get("/health")
def health():
    return {"status": "ok"}
