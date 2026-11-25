import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ExtratoVeracoins,
  SaldoFeirinha,
  descontosDoAluno,
  formatarComSinal,
  formatarDataSemHora,
  formatarTotal,
  formulaDaConta,
  linhasDaConta,
  notaFeirinha,
  pluralMoeda,
  rotuloItem,
  secoesDoExtrato,
} from "./extrato-veracoins";
import { ConfiguracaoRanking, RankingItem } from "./types";

const MARGEM = 14;
const DIREITA = 196;

export interface OpcoesPdfExtrato {
  incluirProfessor: boolean;
  incluirObservacoes: boolean;
}

export interface ExtratoComSaldo {
  extrato: ExtratoVeracoins;
  feirinha: SaldoFeirinha;
}

/** A fonte padrão do PDF só tem caracteres ocidentais; emojis e afins virariam símbolos estranhos. */
function limpar(texto: string): string {
  return texto
    .replace(/[^\s\x20-\xFF–—‘’“”•…]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nomeArquivo(texto: string): string {
  return `${texto.replace(/\s+/g, "_")}.pdf`;
}

function finalY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function emitidoEm(): string {
  return new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function cabecalho(doc: jsPDF, escola: string, titulo: string) {
  doc.setFontSize(15).setTextColor(15, 23, 42);
  doc.text(limpar(escola), MARGEM, 17);
  doc.setFontSize(11).setTextColor(100, 116, 139);
  doc.text(titulo, MARGEM, 24);
}

/** Rodapé com numeração própria: cada aluno recomeça na página 1, para as folhas não se misturarem. */
function rodape(doc: jsPDF, primeira: number, identificacao: string) {
  const ultima = doc.getNumberOfPages();
  for (let p = primeira; p <= ultima; p++) {
    doc.setPage(p);
    doc.setFontSize(8.5).setTextColor(136, 136, 136);
    doc.text(`${identificacao} · Gerado em ${emitidoEm()}`, MARGEM, 289);
    doc.text(`Página ${p - primeira + 1} de ${ultima - primeira + 1}`, DIREITA, 289, { align: "right" });
  }
}

/** Desenha o extrato de um aluno a partir da página atual (que precisa estar em branco). */
function desenharExtrato(doc: jsPDF, { extrato: e, feirinha }: ExtratoComSaldo, opcoes: OpcoesPdfExtrato) {
  const primeira = doc.getNumberOfPages();
  const moedas = pluralMoeda(e.nome_moeda);

  cabecalho(doc, e.escola_nome, `Extrato de ${moedas}`);
  doc.setFontSize(10.5).setTextColor(30, 41, 59);
  doc.text(`Aluno(a): ${limpar(e.aluno_nome)}`, MARGEM, 33);
  doc.text(`Matrícula: ${e.matricula}   |   Turma: ${e.turma ?? "-"}`, MARGEM, 39);
  doc.setDrawColor(203, 213, 225);
  doc.line(MARGEM, 43, DIREITA, 43);

  autoTable(doc, {
    startY: 47,
    theme: "plain",
    styles: { fontSize: 10.5, cellPadding: 1.6 },
    columnStyles: { 1: { textColor: [100, 116, 139] }, 2: { halign: "right" } },
    body: [
      ...linhasDaConta(e).map((l) => [l.rotulo, l.detalhe, formatarComSinal(l.valor, "-")]),
      [moedas, "", formatarTotal(e.pontuacao, "-")],
      ["Gastou na feirinha", "", formatarComSinal(-feirinha.gasto, "-")],
      ["Disponível na feirinha", "", formatarTotal(feirinha.saldo, "-")],
    ],
    didParseCell: ({ row, cell }) => {
      if (row.index !== 4 && row.index !== 6) return;
      cell.styles.fontStyle = "bold";
      if (row.index !== 4) return;
      cell.styles.fillColor = [241, 245, 249];
      cell.styles.fontSize = 12;
    },
  });
  let y = finalY(doc) + 4;
  const nota = notaFeirinha(e.pontuacao);
  if (nota) {
    doc.setFontSize(8.5).setTextColor(100, 116, 139);
    doc.text(nota, MARGEM, y + 1);
    y += 5;
  }

  for (const secao of secoesDoExtrato(e)) {
    y += 5;
    // Evita deixar o título sozinho no fim da página.
    if (y > 262) {
      doc.addPage();
      y = 18;
    }
    doc.setFontSize(11).setTextColor(15, 23, 42).setFont("helvetica", "bold");
    doc.text(secao.rotulo, MARGEM, y);
    doc.text(formatarComSinal(secao.valor, "-"), DIREITA, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    if (secao.itens.length === 0) {
      doc.setFontSize(9.5).setTextColor(100, 116, 139);
      doc.text("Nenhum lançamento.", MARGEM, y + 6);
      y += 8;
      continue;
    }
    const comProfessor = opcoes.incluirProfessor && secao.itens.some((i) => i.professor_nome);
    autoTable(doc, {
      startY: y + 2,
      margin: { bottom: 18 },
      theme: "grid",
      rowPageBreak: "avoid",
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8.5 },
      styles: { fontSize: 8.5, cellPadding: 1.6, lineColor: [203, 213, 225], lineWidth: 0.2 },
      columns: [
        { header: "Data", dataKey: "data" },
        { header: "Lançamento", dataKey: "texto" },
        ...(comProfessor ? [{ header: "Registrado por", dataKey: "professor" }] : []),
        { header: "Valor", dataKey: "valor" },
      ],
      columnStyles: { data: { cellWidth: 22 }, professor: { cellWidth: 52 }, valor: { cellWidth: 20, halign: "right" } },
      body: secao.itens.map((i) => ({
        data: formatarDataSemHora(i.data),
        texto: limpar(
          opcoes.incluirObservacoes && i.observacao ? `${rotuloItem(i.descricao)} — ${i.observacao}` : rotuloItem(i.descricao)
        ),
        professor: limpar(i.professor_nome ?? "Automático"),
        valor: formatarComSinal(i.valor, "-"),
      })),
      didParseCell: ({ section, column, cell }) => {
        if (section === "head" && column.dataKey === "valor") cell.styles.halign = "right";
      },
    });
    y = finalY(doc) + 4;
  }

  rodape(doc, primeira, limpar(e.aluno_nome));
}

export function gerarPdfExtrato(dados: ExtratoComSaldo, opcoes: OpcoesPdfExtrato) {
  const doc = new jsPDF();
  desenharExtrato(doc, dados, opcoes);
  const { nome_moeda, aluno_nome } = dados.extrato;
  doc.save(nomeArquivo(`extrato_${pluralMoeda(nome_moeda).toLowerCase()}_${aluno_nome}`));
}

/** Um arquivo só, com o extrato de cada aluno começando em página nova. */
export function gerarPdfExtratosDaTurma(lista: ExtratoComSaldo[], turma: string, opcoes: OpcoesPdfExtrato) {
  const doc = new jsPDF();
  lista.forEach((dados, i) => {
    if (i > 0) doc.addPage();
    desenharExtrato(doc, dados, opcoes);
  });
  doc.save(nomeArquivo(`extratos_${pluralMoeda(lista[0].extrato.nome_moeda).toLowerCase()}_turma_${turma}`));
}

/** A conta de todos os alunos da turma em uma tabela. Mostra vários alunos: é para a equipe da escola. */
export function gerarPdfResumoTurma(itens: RankingItem[], config: ConfiguracaoRanking, escolaNome: string, turma: string) {
  const doc = new jsPDF();
  const moedas = pluralMoeda(config.nome_moeda);

  cabecalho(doc, escolaNome, `Extrato de ${moedas} — Turma ${turma}`);
  doc.setFontSize(9).setTextColor(100, 116, 139);
  doc.text(doc.splitTextToSize(formulaDaConta(config).replace(/−/g, "-"), DIREITA - MARGEM), MARGEM, 31);
  doc.setFont("helvetica", "bold").setTextColor(185, 28, 28);
  doc.text("Uso interno da escola: contém dados de vários alunos.", MARGEM, 37);
  doc.setFont("helvetica", "normal");

  autoTable(doc, {
    startY: 41,
    margin: { bottom: 18 },
    theme: "grid",
    rowPageBreak: "avoid",
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8.5, halign: "right" },
    styles: { fontSize: 9, cellPadding: 1.8, lineColor: [203, 213, 225], lineWidth: 0.2, halign: "right" },
    columnStyles: {
      0: { halign: "left" },
      1: { cellWidth: 21 },
      2: { cellWidth: 23 },
      3: { cellWidth: 26 },
      4: { cellWidth: 26 },
      5: { cellWidth: 22, fontStyle: "bold" },
    },
    head: [["Aluno", "Méritos", "Ocorrências", "Faltas", "Não entregues", moedas]],
    body: itens.map((i) => {
      const { faltas, naoEntregues } = descontosDoAluno(i, config);
      return [
        limpar(i.aluno_nome),
        formatarComSinal(i.total_merito, "-"),
        formatarComSinal(-i.total_infracao, "-"),
        `${i.faltas_nao_justificadas} = ${formatarComSinal(faltas, "-")}`,
        `${i.atividades_nao_entregues} = ${formatarComSinal(naoEntregues, "-")}`,
        formatarTotal(i.pontuacao, "-"),
      ];
    }),
    didParseCell: ({ section, column, cell }) => {
      if (section === "head" && column.index === 0) cell.styles.halign = "left";
    },
  });

  rodape(doc, 1, `Turma ${turma} · ${itens.length} aluno(s)`);
  doc.save(nomeArquivo(`resumo_${moedas.toLowerCase()}_turma_${turma}`));
}
