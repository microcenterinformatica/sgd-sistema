import { RankingItem } from "./types";

export interface ItemComPosicao {
  item: RankingItem;
  posicao: number;
}

/** Ranking por posição compartilhada: pontuação igual = mesma posição, próxima pula (1º, 1º, 3º). */
export function ordenarComPosicaoCompartilhada(lista: RankingItem[]): ItemComPosicao[] {
  const ordenada = [...lista].sort((a, b) => b.pontuacao - a.pontuacao);
  const resultado: ItemComPosicao[] = [];
  let posicaoAtual = 0;
  let pontuacaoAnterior: number | null = null;
  ordenada.forEach((item, idx) => {
    if (pontuacaoAnterior === null || item.pontuacao !== pontuacaoAnterior) {
      posicaoAtual = idx + 1;
      pontuacaoAnterior = item.pontuacao;
    }
    resultado.push({ item, posicao: posicaoAtual });
  });
  return resultado;
}

/** Certificados com selo de colocação vão do 1º lugar até esta colocação. */
export const ULTIMA_COLOCACAO_PREMIADA = 3;

/** Quem ganha certificado (empatados na mesma colocação entram todos), só com pontuação positiva. */
export function premiados(lista: RankingItem[]): ItemComPosicao[] {
  return ordenarComPosicaoCompartilhada(lista).filter((i) => i.posicao <= ULTIMA_COLOCACAO_PREMIADA && i.item.pontuacao > 0);
}
