// Tipos e utilitários do Cartão com QR + Caixa da Feirinha.

/** Conteúdo do QR impresso: só `VERACOIN:<token>` — nunca nome, matrícula ou id. */
export const PREFIXO_QR = "VERACOIN:";

export interface CartaoStatusAluno {
  aluno_id: number;
  aluno_nome: string;
  numero_chamada: number | null;
  cartao_id: number | null;
  numero: number | null;
  criado_em: string | null;
}

export interface GerarCartoesResultado {
  gerados: number;
  ja_tinham: number;
}

export interface CartaoImpressao {
  aluno_id: number;
  aluno_nome: string;
  numero: number;
  token: string;
}

export interface ImpressaoCartoes {
  escola_nome: string;
  ano: number;
  turma: string;
  cartoes: CartaoImpressao[];
}

export interface CartaoFeirinha {
  aluno_id: number;
  nome: string;
  turma: string | null;
  foto_url: string | null;
  numero: number;
  token: string;
  patrimonio: number;
  gasto: number;
  saldo: number;
}

export interface TransacaoResultado {
  transacao_id: number;
  aluno_id: number;
  aluno_nome: string;
  valor: number;
  saldo: number;
  repetida: boolean;
}

export interface VendaRecente {
  transacao_id: number;
  aluno_nome: string;
  turma: string | null;
  valor: number;
  descricao: string | null;
  criado_em: string;
  estornado: boolean;
  pode_desfazer: boolean;
}

export interface ResumoFeirinha {
  data: string;
  total_geral: number;
  compras: number;
  estornadas: number;
  por_turma: { turma: string | null; compras: number; total: number }[];
  por_aluno: { aluno_id: number; aluno_nome: string; turma: string | null; compras: number; total: number }[];
}

export function formatarNumeroCartao(numero: number): string {
  return String(numero).padStart(4, "0");
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

/** UUID por tentativa de compra. `crypto.randomUUID` só existe em HTTPS/localhost. */
export function novaChaveIdempotencia(): string {
  if (typeof crypto.randomUUID === "function" && window.isSecureContext) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const CONECTIVOS = new Set(["da", "de", "do", "das", "dos", "e", "di", "du"]);

/** "Maria Eduarda dos Santos Oliveira" → "Maria E. S. Oliveira" (mantém primeiro e último nome). */
export function abreviarNomesDoMeio(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 2) return nome.trim();
  const meio = partes
    .slice(1, -1)
    .filter((p) => !CONECTIVOS.has(p.toLowerCase()))
    .map((p) => `${p[0]}.`);
  return [partes[0], ...meio, partes[partes.length - 1]].join(" ");
}

export interface AlunoBusca {
  aluno_id: number;
  nome: string;
  turma: string | null;
}

export interface CompraExtrato {
  transacao_id: number;
  criado_em: string;
  valor: number;
  descricao: string | null;
  operador_nome: string | null;
  estornado: boolean;
}

export interface ExtratoAluno {
  aluno_id: number;
  nome: string;
  turma: string | null;
  numero_cartao: number | null;
  acumulado: number;
  gasto: number;
  saldo: number;
  compras: CompraExtrato[];
}

/** Texto amigável para falhas da câmera do leitor de QR. */
export function mensagemCamera(kind: string): string {
  switch (kind) {
    case "permission-denied":
      return "Permissão da câmera negada. Libere a câmera nas configurações do navegador ou digite o número do cartão.";
    case "insecure-context":
      return "A câmera só funciona com endereço HTTPS. Digite o número do cartão abaixo.";
    case "no-camera":
      return "Nenhuma câmera encontrada. Digite o número do cartão abaixo.";
    case "in-use":
      return "A câmera está sendo usada por outro aplicativo.";
    default:
      return "Não foi possível abrir a câmera. Digite o número do cartão abaixo.";
  }
}
