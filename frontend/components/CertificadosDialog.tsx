"use client";

import { useEffect, useState } from "react";
import { Download, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { LIMITE_TEXTO_CERTIFICADO, gerarPdfCertificados, textoDoCertificado, tituloDoCertificado } from "@/lib/certificado-pdf";
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
  /** Colocação no ranking da turma. */
  posicao: number;
  /** Só o 1º lugar recebe o selo; os demais saem sem selo, se a professora marcar. */
  selo: boolean;
  pontuacao: number;
  nome: string;
  feminino: boolean;
  incluir: boolean;
  /** null = texto padrão do certificado. */
  texto: string | null;
  editandoTexto: boolean;
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
  alunosDaTurma,
  nomeMoeda,
  onFechar,
}: {
  turma: string;
  /** Todos os alunos da turma, já ordenados com a colocação. */
  alunosDaTurma: ItemComPosicao[];
  nomeMoeda: string;
  onFechar: () => void;
}) {
  const [textos, setTextos] = useState<Textos | null>(null);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [data, setData] = useState(hoje);
  const [gerando, setGerando] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    alunosDaTurma.map(({ item, posicao }) => {
      const selo = posicao <= ULTIMA_COLOCACAO_PREMIADA && item.pontuacao > 0;
      return {
        alunoId: item.aluno_id,
        posicao,
        selo,
        pontuacao: item.pontuacao,
        nome: item.aluno_nome,
        feminino: false,
        incluir: selo,
        texto: null,
        editandoTexto: false,
      };
    })
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

  const comSelo = linhas.filter((l) => l.selo);
  const unicoPrimeiro = comSelo.length === 1;
  const textoPadrao = (l: Linha) => textoDoCertificado(l.feminino, l.selo && l.posicao === 1, unicoPrimeiro, ano);
  const demais = linhas.filter((l) => !l.selo);
  const escolhidos = linhas.filter((l) => l.incluir);
  const demaisMarcados = demais.filter((l) => l.incluir).length;
  const marcarDemais = (incluir: boolean) => setLinhas((ls) => ls.map((l) => (l.selo ? l : { ...l, incluir })));

  async function gerar() {
    if (!textos) return;
    if (escolhidos.some((l) => !l.nome.trim())) {
      toast.error("Há um certificado sem o nome do aluno.");
      return;
    }
    setGerando(true);
    try {
      const paraPdf = escolhidos.map((l) => ({ nome: l.nome, feminino: l.feminino, posicao: l.selo ? l.posicao : null, texto: l.texto }));
      await gerarPdfCertificados(paraPdf, unicoPrimeiro, { ...textos, turma, ano, data });
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
        {l.selo ? `${l.posicao}º lugar · com selo` : `${l.posicao}º no ranking · sem selo`} · {l.pontuacao.toLocaleString("pt-BR")} {nomeMoeda}
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
      {l.incluir && !l.editandoTexto && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => mudarLinha(l.alunoId, { editandoTexto: true, texto: l.texto ?? textoPadrao(l) })}
          >
            <Pencil />
            Editar texto
          </Button>
          {l.texto !== null && <span className="text-xs text-muted-foreground">Texto alterado para este aluno</span>}
        </div>
      )}
      {l.incluir && l.editandoTexto && (
        <div className="space-y-2">
          <Textarea
            value={l.texto ?? ""}
            onChange={(e) => mudarLinha(l.alunoId, { texto: e.target.value })}
            maxLength={LIMITE_TEXTO_CERTIFICADO}
            rows={4}
            aria-label={`Texto do certificado de ${l.nome || "aluno"}`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => mudarLinha(l.alunoId, { editandoTexto: false, texto: l.texto?.trim() ? l.texto : null })}>
              Concluir
            </Button>
            <Button variant="outline" size="sm" onClick={() => mudarLinha(l.alunoId, { editandoTexto: false, texto: null })}>
              <RotateCcw />
              Voltar ao texto padrão
            </Button>
            <span className="text-xs text-muted-foreground">
              {(l.texto ?? "").length}/{LIMITE_TEXTO_CERTIFICADO} · texto longo sai com letra menor
            </span>
          </div>
        </div>
      )}
    </li>
  );

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Certificados — Turma {turma}</DialogTitle>
          <DialogDescription>
            O 1º lugar no total de {pluralMoeda(nomeMoeda)} até hoje recebe o certificado com selo. Os demais alunos da turma podem
            receber o certificado sem selo: marque quem vai receber e confira os nomes antes de gerar.
          </DialogDescription>
        </DialogHeader>

        {!textos ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-4">
            {comSelo.length > 0 ? (
              <ul className="divide-y rounded-lg border">{comSelo.map((l) => linhaDoAluno(l))}</ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum aluno da turma tem pontuação positiva para o 1º lugar.</p>
            )}
            {comSelo.length > 1 && <p className="text-xs text-muted-foreground">Há empate no 1º lugar: todos recebem o selo.</p>}

            {demais.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Demais alunos, sem selo ({demaisMarcados} de {demais.length} marcados)
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => marcarDemais(true)}>
                      Marcar todos
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => marcarDemais(false)}>
                      Desmarcar todos
                    </Button>
                  </div>
                </div>
                <ul className="divide-y rounded-lg border">{demais.map((l) => linhaDoAluno(l))}</ul>
              </div>
            )}

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
