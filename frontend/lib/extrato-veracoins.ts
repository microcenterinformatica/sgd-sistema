// Extrato que explica a pontuação do aluno no Patrimônio Disciplinar (aba em Consultas).

import { RankingItem } from "./types";

export interface ExtratoItem {
  /** "aaaa-mm-dd", já no horário de Brasília. */
  data: string;
  descricao: string;
  observacao: string | null;
  professor_nome: string | null;
  /** Quanto soma (+) ou desconta (−). */
  valor: number;
}

export interface ExtratoVeracoins extends RankingItem {
  escola_nome: string;
  matricula: string;
  nome_moeda: string;
  peso_falta: number;
  peso_nao_entrega: number;
  meritos: ExtratoItem[];
  ocorrencias: ExtratoItem[];
  faltas: ExtratoItem[];
  nao_entregues: ExtratoItem[];
}

export interface SaldoFeirinha {
  gasto: number;
  saldo: number;
}

// Textos gravados pelo servidor (app/api/routes/registros.py e app/services/pontuacao.py).
const ROTULOS: Record<string, string> = {
  "PONTO DE MÉRITO/BÔNUS": "Mérito",
  "PONTO DE MÉRITO/BÔNUS (turma)": "Mérito da turma",
  "REMOÇÃO DE MÉRITO (turma)": "Mérito da turma retirado",
  "RECUPERAÇÃO AUTOMÁTICA DE PONTOS": "Recuperação automática",
  "MÉRITO POR BOM COMPORTAMENTO CONTÍNUO": "Bom comportamento contínuo",
};

export function rotuloItem(descricao: string): string {
  return ROTULOS[descricao] ?? descricao;
}

export function pluralMoeda(nome: string): string {
  return /s$/i.test(nome) ? nome : `${nome}s`;
}

export function formatarNumero(v: number): string {
  return Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "+100,00", "−14,00" ou "0,00". O PDF passa "-" porque a fonte dele não tem o sinal "−". */
export function formatarComSinal(v: number, menos = "−"): string {
  if (v === 0) return formatarNumero(0);
  return `${v > 0 ? "+" : menos}${formatarNumero(v)}`;
}

/** Total: só mostra sinal quando é negativo. */
export function formatarTotal(v: number, menos = "−"): string {
  return `${v < 0 ? menos : ""}${formatarNumero(v)}`;
}

export function formatarDataSemHora(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function quantidade(n: number): string {
  return n === 1 ? "1 lançamento" : `${n} lançamentos`;
}

export interface LinhaConta {
  rotulo: string;
  detalhe: string;
  valor: number;
}

/** As quatro partes da conta; a soma delas é a pontuação. */
export function linhasDaConta(e: ExtratoVeracoins): LinhaConta[] {
  return [
    { rotulo: "Méritos", detalhe: quantidade(e.meritos.length), valor: e.total_merito },
    { rotulo: "Ocorrências", detalhe: quantidade(e.ocorrencias.length), valor: -e.total_infracao },
    {
      rotulo: "Faltas não justificadas",
      detalhe: `${e.faltas_nao_justificadas} × ${formatarNumero(e.peso_falta)}`,
      valor: -e.faltas_nao_justificadas * e.peso_falta,
    },
    {
      rotulo: "Atividades não entregues",
      detalhe: `${e.atividades_nao_entregues} × ${formatarNumero(e.peso_nao_entrega)}`,
      valor: -e.atividades_nao_entregues * e.peso_nao_entrega,
    },
  ];
}

export interface SecaoExtrato extends LinhaConta {
  itens: ExtratoItem[];
}

export function secoesDoExtrato(e: ExtratoVeracoins): SecaoExtrato[] {
  const listas = [e.meritos, e.ocorrencias, e.faltas, e.nao_entregues];
  return linhasDaConta(e).map((linha, i) => ({ ...linha, itens: listas[i] }));
}

/** Explica por que o disponível na feirinha não é igual ao total. */
export function notaFeirinha(pontuacao: number): string | null {
  if (pontuacao < 0) return "Enquanto o total for negativo, não há saldo para gastar na feirinha.";
  if (!Number.isInteger(pontuacao)) return `Na feirinha vale só a parte inteira do total (${Math.floor(pontuacao)}).`;
  return null;
}
