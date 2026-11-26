"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { gerarPdfCertificados, tituloDoCertificado } from "@/lib/certificado-pdf";
import { pluralMoeda } from "@/lib/extrato-veracoins";
import { ItemComPosicao, ULTIMA_COLOCACAO_PREMIADA } from "@/lib/ranking";
import { Aluno, AnoLetivo, Escola } from "@/lib/types";
import { versoDaTurma } from "@/lib/verso-cartao";

interface Textos {
  escola: string;
  direcao: string;
  professor: string;
  cargoProfessor: string;
  cidade: string;
}

interface Linha {
  alunoId: number;
  /** null = aluno com 0 pontos no histórico, fora do pódio: certificado sem selo. */
  posicao: number | null;
  pontuacao: number;
  nome: string;
  feminino: boolean;
  incluir: boolean;
}

const chave = (turma: string) => `sgd_certificado_${turma}`;

/** Último preenchimento desta turma; na primeira vez, a equipe já cadastrada para o verso do cartão. */
function textosIniciais(escolaNome: string, turma: string): Textos {
  const verso = versoDaTurma(escolaNome, turma);
  const linha = (inicio: string) => verso?.equipe.find((l) => l.funcao.length === 1 && l.funcao[0].startsWith(inicio));
  const padrao: Textos = {
    escola: verso?.escola ?? escolaNome,
    direcao: linha("Direção")?.nomes[0] ?? "",
    professor: linha("Professor")?.nomes[0] ?? "",
    cargoProfessor: linha("Professor")?.funcao[0] ?? "Professor(a)",
    cidade: "Mococa",
  };
  try {
    return { ...padrao, ...JSON.parse(localStorage.getItem(chave(turma)) ?? "{}") };
  } catch {
    return padrao;
  }
}

function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CertificadosDialog({
  turma,
  premiados,
  nomeMoeda,
  onFechar,
}: {
  turma: string;
  premiados: ItemComPosicao[];
  nomeMoeda: string;
  onFechar: () => void;
}) {
  const [textos, setTextos] = useState<Textos | null>(null);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [data, setData] = useState(hoje);
  const [gerando, setGerando] = useState(false);
  const [incluirZerados, setIncluirZerados] = useState(false);
  const [carregandoZerados, setCarregandoZerados] = useState(true);
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    premiados.map(({ item, posicao }) => ({
      alunoId: item.aluno_id,
      posicao,
      pontuacao: item.pontuacao,
      nome: item.aluno_nome,
      feminino: false,
      incluir: true,
    }))
  );

  useEffect(() => {
    api
      .get<Escola>("/escola")
      .then((e) => setTextos(textosIniciais(e.nome, turma)))
      .catch(() => setTextos(textosIniciais("", turma)));
    api
      .get<AnoLetivo[]>("/anos-letivos")
      .then((lista) => {
        const atual = lista.find((a) => a.situacao === "aberto") ?? lista[0];
        if (atual) setAno(atual.ano);
      })
      .catch(() => undefined);
    const noPodio = new Set(premiados.map((p) => p.item.aluno_id));
    api
      .get<Aluno[]>("/alunos")
      .then((alunos) => {
        const zerados = alunos
          .filter((a) => a.turma === turma && a.pontos_atuais === 0 && !noPodio.has(a.id))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
          .map((a) => ({ alunoId: a.id, posicao: null, pontuacao: 0, nome: a.nome, feminino: false, incluir: true }));
        setLinhas((ls) => [...ls.filter((l) => l.posicao !== null), ...zerados]);
      })
      .catch(() => toast.error("Não foi possível carregar os alunos com 0 pontos."))
      .finally(() => setCarregandoZerados(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turma]);

  const mudarTexto = (campo: keyof Textos, valor: string) => setTextos((t) => t && { ...t, [campo]: valor });
  const mudarLinha = (id: number, mudanca: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l) => (l.alunoId === id ? { ...l, ...mudanca } : l)));

  const podio = linhas.filter((l) => l.posicao !== null);
  const zerados = linhas.filter((l) => l.posicao === null);
  const escolhidos = linhas.filter((l) => l.incluir && (l.posicao !== null || incluirZerados));
  const empate = new Set(podio.map((l) => l.posicao)).size < podio.length;

  async function gerar() {
    if (!textos) return;
    if (escolhidos.some((l) => !l.nome.trim())) {
      toast.error("Há um certificado sem o nome do aluno.");
      return;
    }
    setGerando(true);
    try {
      const unicoPrimeiro = podio.filter((l) => l.posicao === 1).length === 1;
      await gerarPdfCertificados(escolhidos, unicoPrimeiro, { ...textos, turma, ano, data });
      localStorage.setItem(chave(turma), JSON.stringify(textos));
      onFechar();
    } catch {
      toast.error("Não foi possível gerar os certificados. Confira a internet e tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  const linhaDoAluno = (l: Linha) => (
    <li key={l.alunoId} className="p-3 space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={l.incluir}
          onChange={(e) => mudarLinha(l.alunoId, { incluir: e.target.checked })}
          className="size-4 accent-primary"
        />
        {l.posicao !== null ? `${l.posicao}º lugar · ${l.pontuacao.toLocaleString("pt-BR")} ${nomeMoeda}` : "Sem selo · 0 pontos no histórico"}
      </label>
      <Input
        value={l.nome}
        onChange={(e) => mudarLinha(l.alunoId, { nome: e.target.value })}
        disabled={!l.incluir}
        aria-label={`Nome no certificado de ${l.nome || "aluno"}`}
      />
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {[false, true].map((feminino) => (
          <label key={String(feminino)} className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name={`titulo-${l.alunoId}`}
              checked={l.feminino === feminino}
              onChange={() => mudarLinha(l.alunoId, { feminino })}
              disabled={!l.incluir}
              className="accent-primary"
            />
            {tituloDoCertificado(feminino)}
          </label>
        ))}
      </div>
    </li>
  );

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Certificados — Turma {turma}</DialogTitle>
          <DialogDescription>
            Do 1º ao {ULTIMA_COLOCACAO_PREMIADA}º lugar no total de {pluralMoeda(nomeMoeda)} até hoje, com selo. Opcionalmente, os demais
            alunos com 0 pontos no histórico, sem selo. Confira os nomes antes de gerar.
          </DialogDescription>
        </DialogHeader>

        {!textos ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-4">
            {podio.length > 0 ? (
              <ul className="divide-y rounded-lg border">{podio.map((l) => linhaDoAluno(l))}</ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum aluno da turma tem pontuação positiva para o pódio.</p>
            )}
            {empate && <p className="text-xs text-muted-foreground">Há empate: todos os alunos da mesma colocação recebem certificado.</p>}

            <div className="space-y-2 rounded-lg border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={incluirZerados}
                  onChange={(e) => setIncluirZerados(e.target.checked)}
                  disabled={carregandoZerados || zerados.length === 0}
                  className="size-4 accent-primary"
                />
                Incluir os demais alunos com 0 pontos no histórico (sem selo de colocação)
              </label>
              <p className="text-xs text-muted-foreground">
                {carregandoZerados
                  ? "Carregando alunos..."
                  : zerados.length === 0
                    ? "Nenhum outro aluno da turma está com 0 pontos."
                    : `${zerados.length} aluno(s) fora do pódio com 0 pontos.`}
              </p>
              {incluirZerados && zerados.length > 0 && (
                <ul className="divide-y rounded-lg border">{zerados.map((l) => linhaDoAluno(l))}</ul>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="cert-escola">Escola</Label>
                <Input id="cert-escola" value={textos.escola} onChange={(e) => mudarTexto("escola", e.target.value)} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="cert-direcao">Direção (nome)</Label>
                <Input id="cert-direcao" value={textos.direcao} onChange={(e) => mudarTexto("direcao", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cert-professor">Professor(a) (nome)</Label>
                <Input id="cert-professor" value={textos.professor} onChange={(e) => mudarTexto("professor", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cert-cargo">Função que aparece embaixo</Label>
                <Input id="cert-cargo" value={textos.cargoProfessor} onChange={(e) => mudarTexto("cargoProfessor", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cert-cidade">Cidade</Label>
                <Input id="cert-cidade" value={textos.cidade} onChange={(e) => mudarTexto("cidade", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cert-data">Data</Label>
                <Input id="cert-data" type="date" value={data} onChange={(e) => setData(e.target.value || hoje())} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Nome em branco deixa só a linha para assinar. Estes dados ficam guardados neste aparelho.</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={gerar} disabled={!textos || gerando || escolhidos.length === 0}>
            <Download className="size-4" />
            {gerando ? "Gerando..." : `Gerar ${escolhidos.length} certificado(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
