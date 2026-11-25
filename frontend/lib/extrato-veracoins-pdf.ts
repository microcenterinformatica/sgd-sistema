import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ExtratoVeracoins,
  SaldoFeirinha,
  formatarComSinal,
  formatarDataSemHora,
  formatarTotal,
  linhasDaConta,
  notaFeirinha,
  pluralMoeda,
  rotuloItem,
  secoesDoExtrato,
} from "./extrato-veracoins";

const MARGEM = 14;
const DIREITA = 196;

/** A fonte padrão do PDF só tem caracteres ocidentais; emojis e afins virariam símbolos estranhos. */
function limpar(texto: string): string {
  return texto
    .replace(/[^\s\x20-\xFF–—‘’“”•…]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function finalY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

export function gerarPdfExtrato(
  e: ExtratoVeracoins,
  feirinha: SaldoFeirinha,
  opcoes: { incluirProfessor: boolean; incluirObservacoes: boolean }
) {
  const doc = new jsPDF();
  const moedas = pluralMoeda(e.nome_moeda);

  doc.setFontSize(15).setTextColor(15, 23, 42);
  doc.text(limpar(e.escola_nome), MARGEM, 17);
  doc.setFontSize(11).setTextColor(100, 116, 139);
  doc.text(`Extrato de ${moedas}`, MARGEM, 24);
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

  const paginas = doc.getNumberOfPages();
  const emitido = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFontSize(8.5).setTextColor(136, 136, 136);
    doc.text(`Gerado em ${emitido}`, MARGEM, 289);
    doc.text(`Página ${p} de ${paginas}`, DIREITA, 289, { align: "right" });
  }

  doc.save(`extrato_${moedas.toLowerCase()}_${e.aluno_nome.replace(/\s+/g, "_")}.pdf`);
}
