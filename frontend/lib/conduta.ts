import { Punicao } from "./types";

export function calcularStatus(pontos: number, punicoes: Punicao[]): string {
  const aplicaveis = punicoes
    .filter((p) => p.ativo && pontos >= p.pontuacao_minima)
    .sort((a, b) => b.pontuacao_minima - a.pontuacao_minima);
  return aplicaveis[0]?.descricao ?? "Sem conduta";
}
