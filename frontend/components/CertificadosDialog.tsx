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
import { AnoLetivo, Escola } from "@/lib/types";
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
  posicao: number;
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
  }, [turma]);

  const mudarTexto = (campo: keyof Textos, valor: string) => setTextos((t) => t && { ...t, [campo]: valor });
  const mudarLinha = (id: number, mudanca: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l) => (l.alunoId === id ? { ...l, ...mudanca } : l)));

  const escolhidos = linhas.filter((l) => l.incluir);
  const empate = new Set(linhas.map((l) => l.posicao)).size < linhas.length;

  async function gerar() {
    if (!textos) return;
    if (escolhidos.some((l) => !l.nome.trim())) {
      toast.error("Há um certificado sem o nome do aluno.");
      return;
    }
    setGerando(true);
    try {
      const unicoPrimeiro = linhas.filter((l) => l.posicao === 1).length === 1;
      await gerarPdfCertificados(escolhidos, unicoPrimeiro, { ...textos, turma, ano, data });
      localStorage.setItem(chave(turma), JSON.stringify(textos));
      onFechar();
    } catch {
      toast.error("Não foi possível gerar os certificados. Confira a internet e tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Certificados — Turma {turma}</DialogTitle>
          <DialogDescription>
            Do 1º ao {ULTIMA_COLOCACAO_PREMIADA}º lugar no total de {pluralMoeda(nomeMoeda)} até hoje. Confira os nomes antes de gerar.
          </DialogDescription>
        </DialogHeader>

        {!textos ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-4">
            <ul className="divide-y rounded-lg border">
              {linhas.map((l) => (
                <li key={l.alunoId} className="p-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={l.incluir}
                      onChange={(e) => mudarLinha(l.alunoId, { incluir: e.target.checked })}
                      className="size-4 accent-primary"
                    />
                    {l.posicao}º lugar · {l.pontuacao.toLocaleString("pt-BR")} {nomeMoeda}
                  </label>
                  <Input
                    value={l.nome}
                    onChange={(e) => mudarLinha(l.alunoId, { nome: e.target.value })}
                    disabled={!l.incluir}
                    aria-label={`Nome no certificado do ${l.posicao}º lugar`}
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
              ))}
            </ul>
            {empate && <p className="text-xs text-muted-foreground">Há empate: todos os alunos da mesma colocação recebem certificado.</p>}

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
