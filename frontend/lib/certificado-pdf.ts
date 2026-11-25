import jsPDF from "jspdf";

export interface DadosCertificado {
  escola: string;
  turma: string;
  ano: number;
  direcao: string;
  professor: string;
  cargoProfessor: string;
  cidade: string;
  /** "aaaa-mm-dd" */
  data: string;
}

export interface PremiadoCertificado {
  posicao: number;
  nome: string;
  /** Escolhido por quem gera; nunca deduzido do nome. */
  feminino: boolean;
}

type Cor = [number, number, number];
const NAVY: Cor = [19, 41, 75];
const OURO: Cor = [200, 162, 38];
const OURO_ESCURO: Cor = [143, 108, 18];
const TEXTO: Cor = [45, 55, 72];
const MEDALHAS: Record<number, { fundo: Cor; texto: Cor }> = {
  1: { fundo: [212, 175, 55], texto: NAVY },
  2: { fundo: [176, 184, 196], texto: NAVY },
  3: { fundo: [184, 115, 51], texto: [255, 255, 255] },
};
// Do 4º lugar em diante: medalha azul com letras douradas.
const MEDALHA_DEMAIS: { fundo: Cor; texto: Cor } = { fundo: [44, 82, 130], texto: [240, 210, 122] };

const LARGURA = 297;
const ALTURA = 210;
const CENTRO = LARGURA / 2;

/** A fonte Cinzel cobre as letras do português; emojis e afins são retirados. */
function limpar(texto: string): string {
  return texto
    .replace(/[^\s\x20-\xFF–—‘’“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function carregarDataUrl(url: string): Promise<string> {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`Não foi possível carregar ${url}`);
  const blob = await resposta.blob();
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result as string);
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(blob);
  });
}

function dataPorExtenso(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

export function tituloDoCertificado(feminino: boolean): string {
  return feminino ? "Aluna mais disciplinada" : "Aluno mais disciplinado";
}

/** Só o 1º lugar sem empate é "o que mais se destacou"; os demais são "um dos que mais se destacaram". */
function textoDoCertificado(feminino: boolean, unicoPrimeiro: boolean, ano: number): string {
  const quem = unicoPrimeiro
    ? `${feminino ? "a aluna" : "o aluno"} que mais se destacou`
    : `${feminino ? "uma das alunas" : "um dos alunos"} que mais se destacaram`;
  return (
    `foi ${quem} pela disciplina, respeito às regras e boas atitudes durante o ano letivo de ${ano}, ` +
    `conforme os registros do Sistema de Gestão da Disciplina (SGD), ` +
    `sendo ${feminino ? "reconhecida" : "reconhecido"} como exemplo para toda a comunidade escolar.`
  );
}

function estrela(doc: jsPDF, x: number, y: number, r: number, cor: Cor) {
  const m = r * 0.22;
  doc.setFillColor(...cor);
  doc.lines(
    [
      [m, r - m],
      [r - m, m],
      [-(r - m), m],
      [-m, r - m],
      [-m, -(r - m)],
      [-(r - m), -m],
      [r - m, -m],
    ],
    x,
    y - r,
    [1, 1],
    "F",
    true
  );
}

function moldura(doc: jsPDF) {
  doc.setDrawColor(...NAVY).setLineWidth(2.4);
  doc.rect(8, 8, LARGURA - 16, ALTURA - 16);
  doc.setDrawColor(...OURO).setLineWidth(0.8);
  doc.rect(12, 12, LARGURA - 24, ALTURA - 24);
  doc.setLineWidth(0.25);
  doc.rect(13.8, 13.8, LARGURA - 27.6, ALTURA - 27.6);
  for (const x of [12.9, LARGURA - 12.9]) {
    for (const y of [12.9, ALTURA - 12.9]) {
      doc.setFillColor(255, 255, 255);
      doc.circle(x, y, 4.2, "F");
      estrela(doc, x, y, 4.6, OURO);
    }
  }
}

function medalha(doc: jsPDF, posicao: number, y: number) {
  const { fundo, texto } = MEDALHAS[posicao] ?? MEDALHA_DEMAIS;
  doc.setFillColor(...NAVY);
  for (const lado of [-1, 1]) {
    doc.lines(
      [
        [lado * 9, 0],
        [lado * 4, 18],
        [lado * -5.5, -3.2],
        [lado * -4.5, 4.4],
      ],
      CENTRO + lado * 1,
      y + 8,
      [1, 1],
      "F",
      true
    );
  }
  doc.setFillColor(...fundo);
  doc.circle(CENTRO, y, 15, "F");
  doc.setDrawColor(255, 255, 255).setLineWidth(0.7);
  doc.circle(CENTRO, y, 12.7, "S");
  doc.setTextColor(...texto).setFont("Cinzel", "bold").setFontSize(27);
  doc.text(`${posicao}º`, CENTRO, y + 2.6, { align: "center" });
  doc.setFontSize(9);
  doc.text("LUGAR", CENTRO, y + 8, { align: "center" });
}

function assinatura(doc: jsPDF, x: number, nome: string, cargo: string) {
  doc.setDrawColor(...NAVY).setLineWidth(0.3);
  doc.line(x - 42, 177, x + 42, 177);
  doc.setTextColor(...NAVY).setFont("helvetica", "bold").setFontSize(11);
  if (nome) doc.text(nome, x, 182.5, { align: "center" });
  doc.setTextColor(...TEXTO).setFont("helvetica", "normal").setFontSize(10);
  doc.text(cargo, x, nome ? 187.5 : 182.5, { align: "center" });
}

/** Um PDF A4 deitado, com uma folha por premiado. */
export async function gerarPdfCertificados(premiados: PremiadoCertificado[], unicoPrimeiro: boolean, dados: DadosCertificado) {
  const [fonte, logoPrefeitura, brasao, logoMoeda] = await Promise.all([
    carregarDataUrl("/fonts/Cinzel-Bold.ttf"),
    carregarDataUrl("/logo-prefeitura-mococa.png"),
    carregarDataUrl("/brasao-mococa.jpg"),
    carregarDataUrl("/veracoin-logo.png"),
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  doc.addFileToVFS("Cinzel-Bold.ttf", fonte.slice(fonte.indexOf(",") + 1));
  doc.addFont("Cinzel-Bold.ttf", "Cinzel", "bold");

  premiados.forEach((p, i) => {
    if (i > 0) doc.addPage();

    // Marca-d'água: brasão da Prefeitura atrás do texto (o logo inteiro tem letras que atrapalham a leitura).
    doc.saveGraphicsState();
    doc.setGState(doc.GState({ opacity: 0.11 }));
    doc.addImage(brasao, "JPEG", CENTRO - 54, 61, 108, 108.5, "brasao", "FAST");
    doc.restoreGraphicsState();

    moldura(doc);
    doc.addImage(logoPrefeitura, "PNG", 22, 20, 33.7, 24, "prefeitura", "FAST");
    doc.addImage(logoMoeda, "PNG", LARGURA - 50, 19, 27, 27, "moeda", "FAST");

    doc.setTextColor(...NAVY).setFont("helvetica", "bold").setFontSize(13);
    doc.text(limpar(dados.escola), CENTRO, 27, { align: "center" });
    doc.setFont("Cinzel", "bold").setFontSize(40);
    doc.text("CERTIFICADO", CENTRO, 43.5, { align: "center" });
    doc.setTextColor(...OURO_ESCURO).setFontSize(16);
    doc.text(limpar(`${tituloDoCertificado(p.feminino)} · Turma ${dados.turma}`).toUpperCase(), CENTRO, 53, { align: "center" });

    medalha(doc, p.posicao, 74);

    doc.setTextColor(...TEXTO).setFont("times", "italic").setFontSize(17);
    doc.text("Certificamos que", CENTRO, 112, { align: "center" });

    const nome = limpar(p.nome).toUpperCase();
    doc.setTextColor(...NAVY).setFont("Cinzel", "bold");
    let tamanho = 30;
    doc.setFontSize(tamanho);
    while (tamanho > 14 && doc.getTextWidth(nome) > 238) doc.setFontSize(--tamanho);
    doc.text(nome, CENTRO, 125, { align: "center" });
    doc.setDrawColor(...OURO).setLineWidth(0.5);
    doc.line(CENTRO - 85, 129, CENTRO + 85, 129);

    doc.setTextColor(...TEXTO).setFont("times", "normal").setFontSize(16);
    const texto = textoDoCertificado(p.feminino, p.posicao === 1 && unicoPrimeiro, dados.ano);
    doc.text(doc.splitTextToSize(texto, 222), CENTRO, 138, { align: "center", lineHeightFactor: 1.35 });

    doc.setFontSize(13);
    doc.text(limpar(dados.cidade ? `${dados.cidade}, ${dataPorExtenso(dados.data)}.` : `${dataPorExtenso(dados.data)}.`), CENTRO, 163, {
      align: "center",
    });

    assinatura(doc, CENTRO - 60, limpar(dados.direcao), "Direção");
    assinatura(doc, CENTRO + 60, limpar(dados.professor), limpar(dados.cargoProfessor) || "Professor(a)");
  });

  doc.save(`certificados_turma_${dados.turma.replace(/\s+/g, "_")}.pdf`);
}
