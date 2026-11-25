"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Cinzel, Inter } from "next/font/google";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import RequireAuth from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { CartaoImpressao, ImpressaoCartoes, PREFIXO_QR, abreviarNomesDoMeio, formatarNumeroCartao } from "@/lib/feirinha";
import { ConfiguracaoRanking } from "@/lib/types";
import { LinhaEquipe, VersoEquipe, versoDaTurma } from "@/lib/verso-cartao";

const cinzel = Cinzel({ subsets: ["latin"], weight: ["700"] });
const inter = Inter({ subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"] });

const NAVY = "#13294B";
const GOLD = "#E8C766";
const SILVER = "#C0C6CE";

const CARTOES_POR_FOLHA = 10;
// Largura útil do nome: cartão 85,6 − margens 2×4 − QR 22 − respiro 3 (mm).
const LARGURA_NOME_MM = 52.6;
const NOME_PT_MAX = 10;
const NOME_PT_MIN = 6.5;

// Verso com equipe: área útil 85,6 − margens 2×4,25 (mm).
const VERSO_UTIL_MM = 77.1;
const VERSO_LOGO_MM = 12.7;
const VERSO_FUNCAO_MM = 19.5;
const VERSO_ESCOLA_MM = VERSO_UTIL_MM - VERSO_LOGO_MM - 1.5;
const VERSO_NOMES_MM = VERSO_UTIL_MM - VERSO_FUNCAO_MM;
const VERSO_OURO = "#C8A226";
// 2px = 0,53 mm. Em mm, o navegador arredonda a borda para baixo e ela sai com metade da espessura.
const VERSO_BORDA = "2px";

// Ordem de tentativa do logo: arquivo novo (se for colocado em public/) e, por
// fim, a moeda que o sistema já usa.
const LOGOS = ["/veracoin-logo.png", "/veracoin-logo.svg", "/veracom/veracom-coin.svg"];

interface NomeAjustado {
  texto: string;
  pt: number;
}

interface VersoAjustado extends VersoEquipe {
  escolaPt: number;
  nomesPt: number;
}

function medirMm(texto: string, pt: number, familia: string, peso = 700): number {
  const canvas = medirMm.canvas ?? (medirMm.canvas = document.createElement("canvas"));
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${peso} ${(pt * 96) / 72}px ${familia}`;
  return (ctx.measureText(texto).width * 25.4) / 96;
}
medirMm.canvas = null as HTMLCanvasElement | null;

/** Reduz a fonte até caber em uma linha; se nem no mínimo couber, abrevia os nomes do meio. */
function ajustarNome(nome: string, familia: string): NomeAjustado {
  const candidatos = [nome.toUpperCase(), abreviarNomesDoMeio(nome).toUpperCase()];
  for (const texto of candidatos) {
    for (let pt = NOME_PT_MAX; pt >= NOME_PT_MIN; pt -= 0.25) {
      if (medirMm(texto, pt, familia) <= LARGURA_NOME_MM) return { texto, pt };
    }
  }
  return { texto: candidatos[1], pt: NOME_PT_MIN };
}

/** Maior fonte (entre max e min) em que todos os textos cabem em uma linha. */
function maiorFonte(textos: string[], max: number, min: number, larguraMm: number, familia: string, peso: number): number {
  let pt = max;
  while (pt > min && textos.some((t) => medirMm(t, pt, familia, peso) > larguraMm)) pt -= 0.25;
  return pt;
}

/** Todos os nomes da equipe ficam do mesmo tamanho; quem não couber nem no mínimo é abreviado. */
function ajustarVerso(verso: VersoEquipe, familia: string): VersoAjustado {
  const min = 5.5;
  const equipe: LinhaEquipe[] = verso.equipe.map((l) => ({
    ...l,
    nomes: l.nomes.map((n) => (medirMm(n, min, familia, 600) > VERSO_NOMES_MM ? abreviarNomesDoMeio(n) : n)),
  }));
  return {
    ...verso,
    equipe,
    escolaPt: maiorFonte([verso.escola], 8, 6, VERSO_ESCOLA_MM, familia, 700),
    nomesPt: maiorFonte(equipe.flatMap((l) => l.nomes), 7, min, VERSO_NOMES_MM, familia, 600),
  };
}

function Estrela({ tamanho, cor }: { tamanho: string; cor: string }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: tamanho, height: tamanho, flexShrink: 0 }} aria-hidden>
      <path d="M12 0 L14.6 9.4 L24 12 L14.6 14.6 L12 24 L9.4 14.6 L0 12 L9.4 9.4 Z" fill={cor} />
    </svg>
  );
}

function Logo({ tamanho }: { tamanho: string }) {
  const [indice, setIndice] = useState(0);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGOS[indice]}
      alt=""
      style={{ width: tamanho, height: tamanho, objectFit: "contain", flexShrink: 0 }}
      onError={() => setIndice((i) => Math.min(i + 1, LOGOS.length - 1))}
    />
  );
}

function Chip({ claro }: { claro: boolean }) {
  return (
    <div
      style={{
        width: "9mm",
        height: "6.8mm",
        borderRadius: "1.2mm",
        background: "linear-gradient(135deg, #F3DC8E 0%, #D4AF37 50%, #F0D27A 100%)",
        border: claro ? `0.2mm solid ${NAVY}33` : "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {[1.7, 3.4, 5.1].map((top) => (
        <div key={top} style={{ position: "absolute", left: 0, right: 0, top: `${top}mm`, height: "0.2mm", background: "#9C7A1F88" }} />
      ))}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: "4.4mm", width: "0.2mm", background: "#9C7A1F88" }} />
    </div>
  );
}

function Frente({
  cartao,
  nome,
  turma,
  ano,
  moeda,
  claro,
}: {
  cartao: CartaoImpressao;
  nome: NomeAjustado;
  turma: string;
  ano: number;
  moeda: string;
  claro: boolean;
}) {
  const corTexto = claro ? NAVY : "#FFFFFF";
  const corDestaque = claro ? NAVY : GOLD;
  const corSecundaria = claro ? "#4A5B78" : SILVER;
  return (
    <div
      className="cartao"
      style={{
        background: claro ? "#FFFFFF" : NAVY,
        border: claro ? `0.5mm solid ${NAVY}` : "none",
        color: corTexto,
      }}
    >
      {/* Aro decorativo no canto superior direito */}
      <div
        style={{
          position: "absolute",
          right: "-15mm",
          top: "-17mm",
          width: "46mm",
          height: "46mm",
          borderRadius: "50%",
          border: `3.2mm solid ${claro ? NAVY : GOLD}`,
          opacity: claro ? 0.06 : 0.12,
        }}
      />

      <div style={{ position: "absolute", left: "4mm", top: "3.5mm", display: "flex", alignItems: "center", gap: "2mm" }}>
        <Logo tamanho="14mm" />
        <div>
          <div className={cinzel.className} style={{ fontWeight: 700, fontSize: "11pt", letterSpacing: "0.12em", color: corDestaque, lineHeight: 1 }}>
            {moeda.toUpperCase()}
          </div>
          <div style={{ fontWeight: 600, fontSize: "7pt", color: corSecundaria, letterSpacing: "0.08em", marginTop: "1mm" }}>
            CARTÃO DO ALUNO
          </div>
        </div>
      </div>

      <div className={cinzel.className} style={{ position: "absolute", right: "4.5mm", top: "4.5mm", fontWeight: 700, fontSize: "9pt", color: corDestaque }}>
        {ano}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "20.5mm",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "1.8mm",
        }}
      >
        <Estrela tamanho="2.4mm" cor={corDestaque} />
        <span className={cinzel.className} style={{ fontWeight: 700, fontSize: "8.5pt", letterSpacing: "0.1em", color: corDestaque, whiteSpace: "nowrap" }}>
          A MOEDA DAS BOAS ATITUDES
        </span>
        <Estrela tamanho="2.4mm" cor={corDestaque} />
      </div>

      <div style={{ position: "absolute", left: "4mm", bottom: "4mm", width: `${LARGURA_NOME_MM}mm` }}>
        <Chip claro={claro} />
        <div style={{ fontWeight: 700, fontSize: `${nome.pt}pt`, color: corTexto, whiteSpace: "nowrap", marginTop: "2mm", lineHeight: 1.15 }}>
          {nome.texto}
        </div>
        <div style={{ fontWeight: 500, fontSize: "7.5pt", color: corSecundaria, marginTop: "0.6mm" }}>
          Turma {turma} · Nº {formatarNumeroCartao(cartao.numero)}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: "4mm",
          bottom: "4mm",
          width: "22mm",
          height: "22mm",
          background: "#FFFFFF",
          borderRadius: "2mm",
          border: claro ? `0.3mm solid ${NAVY}` : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <QRCodeSVG value={`${PREFIXO_QR}${cartao.token}`} level="M" marginSize={0} style={{ width: "19mm", height: "19mm" }} />
      </div>
    </div>
  );
}

function VersoComEquipe({ verso, claro }: { verso: VersoAjustado; claro: boolean }) {
  const ultima = verso.equipe.length - 1;
  return (
    <div className="cartao" style={{ background: "#FFFFFF", border: `${VERSO_BORDA} solid ${NAVY}`, color: NAVY }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: "2.2mm", height: "3mm", background: claro ? "#D5D9DF" : NAVY }} />

      <div
        style={{
          position: "absolute",
          left: "3.75mm",
          width: `${VERSO_UTIL_MM}mm`,
          top: "7.4mm",
          height: "9mm",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ whiteSpace: "nowrap" }}>
          <div style={{ fontWeight: 700, fontSize: `${verso.escolaPt}pt`, lineHeight: 1.2 }}>{verso.escola}</div>
          <div style={{ fontWeight: 500, fontStyle: "italic", fontSize: "7pt", lineHeight: 1.2, marginTop: "1mm", color: "#2D3748" }}>
            {verso.frase}
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={verso.logo}
          alt=""
          style={{ height: "9mm", width: `${VERSO_LOGO_MM}mm`, objectFit: "contain", objectPosition: "right center", flexShrink: 0 }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          left: "3.75mm",
          width: `${VERSO_UTIL_MM}mm`,
          top: "18.4mm",
          bottom: "2.6mm",
          borderTop: `${VERSO_BORDA} solid ${VERSO_OURO}`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {verso.equipe.map((linha, i) => (
          <div
            key={linha.funcao.join(" ")}
            style={{
              display: "flex",
              alignItems: "baseline",
              padding: "0.9mm 0",
              borderBottom: i < ultima ? "0.2mm solid #D5D9E1" : "none",
            }}
          >
            <div
              style={{
                width: `${VERSO_FUNCAO_MM}mm`,
                flexShrink: 0,
                fontWeight: 600,
                fontSize: "5.5pt",
                lineHeight: 1.35,
                letterSpacing: "0.06em",
                color: "#4A5568",
                textTransform: "uppercase",
              }}
            >
              {linha.funcao.map((f) => (
                <div key={f}>{f}</div>
              ))}
            </div>
            <div style={{ fontWeight: 600, fontSize: `${verso.nomesPt}pt`, lineHeight: 1.3, whiteSpace: "nowrap" }}>
              {linha.nomes.map((n) => (
                <div key={n}>{n}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Verso padrão, para turmas sem lista de equipe em lib/verso-cartao.ts. */
function Verso({ escola, moeda, claro }: { escola: string; moeda: string; claro: boolean }) {
  return (
    <div className="cartao" style={{ background: "#FFFFFF", border: `0.5mm solid ${NAVY}`, color: NAVY }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: "4.5mm", height: "7mm", background: claro ? "#D5D9DF" : NAVY }} />

      <div style={{ position: "absolute", left: "4mm", top: "14.5mm", width: "47mm" }}>
        <div style={{ fontWeight: 700, fontSize: "7.5pt", lineHeight: 1.2 }}>{escola}</div>
        <div style={{ fontWeight: 500, fontSize: "6.5pt", lineHeight: 1.3, marginTop: "1.5mm" }}>
          Cartão pessoal e intransferível. Use seus {moeda.toLowerCase()}s na feirinha da escola.
        </div>
        <div style={{ fontWeight: 500, fontSize: "6.5pt", lineHeight: 1.3, marginTop: "1mm" }}>
          Perdeu? Avise seu professor para gerar um novo.
        </div>
      </div>

      <div style={{ position: "absolute", left: "4mm", bottom: "4.5mm", width: "47mm" }}>
        <div style={{ borderTop: `0.25mm solid ${NAVY}` }} />
        <div style={{ fontWeight: 500, fontSize: "6pt", marginTop: "0.6mm", color: "#4A5B78" }}>Assinatura do aluno</div>
      </div>

      <div
        style={{
          position: "absolute",
          right: "4mm",
          top: "14.5mm",
          bottom: "4.5mm",
          width: "26mm",
          border: `0.3mm dashed ${NAVY}99`,
          borderRadius: "1.5mm",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          fontWeight: 600,
          fontSize: "6pt",
          color: "#6B7A93",
          padding: "1mm",
        }}
      >
        ESPAÇO DO PATROCINADOR
      </div>
    </div>
  );
}

const ESTILO_IMPRESSAO = `
@page { size: A4; margin: 0; }
#impressao-cartoes { position: fixed; inset: 0; z-index: 100; overflow: auto; background: #CBD5E1; }
#impressao-cartoes .folha {
  width: 210mm; height: 297mm; box-sizing: border-box; background: #fff;
  display: grid; grid-template-columns: repeat(2, 85.6mm); grid-auto-rows: 54mm; gap: 2.6mm;
  justify-content: center; align-content: center;
  margin: 0 auto 8mm; box-shadow: 0 2px 10px rgba(0,0,0,.25);
}
#impressao-cartoes .cartao {
  position: relative; width: 85.6mm; height: 54mm; box-sizing: border-box;
  border-radius: 3mm; overflow: hidden;
}
#impressao-cartoes, #impressao-cartoes * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media print {
  body > *:not(#impressao-cartoes) { display: none !important; }
  html, body { background: #fff !important; }
  #impressao-cartoes { position: static; overflow: visible; background: none; }
  #impressao-cartoes .no-print { display: none !important; }
  #impressao-cartoes .folha { margin: 0; box-shadow: none; break-after: page; page-break-after: always; }
  #impressao-cartoes .folha:last-child { break-after: auto; page-break-after: auto; }
}
`;

function dividirEmFolhas<T>(itens: T[]): T[][] {
  const folhas: T[][] = [];
  for (let i = 0; i < itens.length; i += CARTOES_POR_FOLHA) folhas.push(itens.slice(i, i + CARTOES_POR_FOLHA));
  return folhas;
}

function Impressao() {
  const params = useSearchParams();
  const turmaId = params.get("turma_id");
  const alunoId = params.get("aluno_id");
  const [dados, setDados] = useState<ImpressaoCartoes | null>(null);
  const [moeda, setMoeda] = useState("Veracom");
  const [erro, setErro] = useState<string | null>(null);
  const [claro, setClaro] = useState(false);
  const [nomes, setNomes] = useState<Record<number, NomeAjustado> | null>(null);
  const [verso, setVerso] = useState<VersoAjustado | null>(null);

  useEffect(() => {
    if (!turmaId) return;
    const sufixo = alunoId ? `&aluno_id=${alunoId}` : "";
    api
      .get<ImpressaoCartoes>(`/cartoes/imprimir?turma_id=${turmaId}${sufixo}`)
      .then(setDados)
      .catch((e) => setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os cartões."));
    api
      .get<ConfiguracaoRanking>("/configuracao-ranking")
      .then((c) => setMoeda(c.nome_moeda))
      .catch(() => undefined);
  }, [turmaId, alunoId]);

  // Mede os nomes só depois que a fonte Inter carregou (senão a medida sai errada).
  useEffect(() => {
    if (!dados) return;
    let cancelado = false;
    document.fonts.ready.then(async () => {
      await Promise.all([700, 600].map((peso) => document.fonts.load(`${peso} 13px ${inter.style.fontFamily}`)));
      if (cancelado) return;
      const mapa: Record<number, NomeAjustado> = {};
      for (const c of dados.cartoes) mapa[c.aluno_id] = ajustarNome(c.aluno_nome, inter.style.fontFamily);
      const daTurma = versoDaTurma(dados.escola_nome, dados.turma);
      setVerso(daTurma && ajustarVerso(daTurma, inter.style.fontFamily));
      setNomes(mapa);
    });
    return () => {
      cancelado = true;
    };
  }, [dados]);

  const folhas = useMemo(() => (dados ? dividirEmFolhas(dados.cartoes) : []), [dados]);

  // RequireAuth só renderiza no navegador (depois de ler o login), então `document` existe aqui.
  if (!turmaId) return <p className="p-8 text-destructive">Turma não informada.</p>;
  if (erro) return <p className="p-8 text-destructive">{erro}</p>;
  if (!dados || !nomes) return <p className="p-8 text-slate-500">Preparando cartões...</p>;
  if (dados.cartoes.length === 0) {
    return <p className="p-8 text-slate-500">Nenhum cartão ativo nesta turma. Gere os cartões antes de imprimir.</p>;
  }

  return createPortal(
    <div id="impressao-cartoes" className={inter.className}>
      <style>{ESTILO_IMPRESSAO}</style>
      <div className="no-print sticky top-0 z-10 bg-white border-b px-4 py-3 mb-6 flex flex-wrap items-center gap-4 justify-between">
        <div className="text-sm text-slate-700">
          <strong>Turma {dados.turma}</strong> · {dados.cartoes.length} cartão(ões) · {folhas.length} folha(s) de frente + {folhas.length} de verso
          <div className="text-xs text-slate-500">
            Imprima em A4, escala 100% (&quot;tamanho real&quot;), sem margens. As frentes vêm primeiro; depois recoloque as folhas para imprimir os versos.
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={claro} onChange={(e) => setClaro(e.target.checked)} className="size-4" />
            Tema claro (economiza tinta)
          </label>
          <Button onClick={() => window.print()}>
            <Printer className="size-4 mr-1" /> Imprimir
          </Button>
        </div>
      </div>

      {folhas.map((folha, i) => (
        <div className="folha" key={`frente-${i}`}>
          {folha.map((c) => (
            <Frente key={c.aluno_id} cartao={c} nome={nomes[c.aluno_id]} turma={dados.turma} ano={dados.ano} moeda={moeda} claro={claro} />
          ))}
        </div>
      ))}
      {/* Versos são todos iguais: cada folha de verso vem cheia (10), assim o alinhamento
          frente/verso não depende da posição nem da ordem em que as folhas voltam à impressora. */}
      {folhas.map((_, i) => (
        <div className="folha" key={`verso-${i}`}>
          {Array.from({ length: CARTOES_POR_FOLHA }, (_, j) =>
            verso ? (
              <VersoComEquipe key={j} verso={verso} claro={claro} />
            ) : (
              <Verso key={j} escola={dados.escola_nome} moeda={moeda} claro={claro} />
            )
          )}
        </div>
      ))}
    </div>,
    document.body
  );
}

export default function ImprimirCartoesPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<p className="p-8 text-slate-500">Carregando...</p>}>
        <Impressao />
      </Suspense>
    </RequireAuth>
  );
}
