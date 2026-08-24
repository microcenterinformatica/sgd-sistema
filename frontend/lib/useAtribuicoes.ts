"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { MinhasAtribuicoesRead, TurmaDisciplinaPermitida } from "./types";

export function useAtribuicoes() {
  const [dados, setDados] = useState<MinhasAtribuicoesRead | null>(null);

  useEffect(() => {
    api.get<MinhasAtribuicoesRead>("/minhas-atribuicoes").then(setDados);
  }, []);

  const turmas = dados ? Array.from(new Set(dados.combinacoes.map((c) => c.turma))).sort() : [];

  function disciplinasDaTurma(turma: string): TurmaDisciplinaPermitida[] {
    if (!dados) return [];
    const vistas = new Set<number>();
    const resultado: TurmaDisciplinaPermitida[] = [];
    for (const c of dados.combinacoes) {
      if (c.turma !== turma || vistas.has(c.disciplina_id)) continue;
      vistas.add(c.disciplina_id);
      resultado.push(c);
    }
    return resultado;
  }

  return { dados, turmas, disciplinasDaTurma };
}
