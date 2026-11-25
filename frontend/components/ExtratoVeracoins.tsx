"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import {
  ExtratoVeracoins as Extrato,
  SaldoFeirinha,
  formatarComSinal,
  formatarDataSemHora,
  formatarNumero,
  formatarTotal,
  linhasDaConta,
  notaFeirinha,
  pluralMoeda,
  rotuloItem,
  secoesDoExtrato,
} from "@/lib/extrato-veracoins";
import { gerarPdfExtrato } from "@/lib/extrato-veracoins-pdf";
import { ConfiguracaoRanking, RankingItem } from "@/lib/types";

const COLUNAS_TURMA = "sm:grid sm:grid-cols-[minmax(0,1fr)_5rem_5rem_8rem_8rem_6rem] sm:gap-2 sm:items-center";

function corDoValor(v: number): string {
  if (v === 0) return "text-muted-foreground";
  return v > 0 ? "text-emerald-700" : "text-red-700";
}

function mensagemErro(e: unknown): string {
  return e instanceof ApiError ? e.message : "Sem conexão com o servidor.";
}

/** A conta de todos os alunos da turma, lado a lado. Clicar no aluno abre o extrato dele. */
function ContaDaTurma({ turma, onAbrirAluno }: { turma: string; onAbrirAluno: (id: number) => void }) {
  const [dados, setDados] = useState<{ itens: RankingItem[]; config: ConfiguracaoRanking } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    Promise.all([api.get<RankingItem[]>("/ranking"), api.get<ConfiguracaoRanking>("/configuracao-ranking")])
      .then(([itens, config]) => !cancelado && setDados({ itens, config }))
      .catch((e) => !cancelado && setErro(mensagemErro(e)));
    return () => {
      cancelado = true;
    };
  }, []);

  if (erro) return <p className="text-sm text-destructive">{erro}</p>;
  if (!dados) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const { config } = dados;
  const itens = dados.itens
    .filter((i) => i.turma === turma)
    .sort((a, b) => b.pontuacao - a.pontuacao || a.aluno_nome.localeCompare(b.aluno_nome));

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>
          Extrato de {pluralMoeda(config.nome_moeda)} — Turma {turma}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {pluralMoeda(config.nome_moeda)} = méritos − ocorrências − faltas não justificadas × {formatarNumero(config.peso_falta)} − atividades não
          entregues × {formatarNumero(config.peso_nao_entrega)}. Clique no aluno para ver cada lançamento.
        </p>
      </CardHeader>
      <CardContent className="text-sm">
        {itens.length === 0 ? (
          <p className="text-muted-foreground">Nenhum aluno encontrado nessa turma.</p>
        ) : (
          <>
            <div className={`hidden ${COLUNAS_TURMA} py-2 text-xs text-muted-foreground border-b`}>
              <span>Aluno</span>
              <span className="text-right">Méritos</span>
              <span className="text-right">Ocorrências</span>
              <span className="text-right">Faltas</span>
              <span className="text-right">Não entregues</span>
              <span className="text-right">{pluralMoeda(config.nome_moeda)}</span>
            </div>
            <ul className="divide-y">
              {itens.map((i) => {
                const faltas = -i.faltas_nao_justificadas * config.peso_falta;
                const naoEntregues = -i.atividades_nao_entregues * config.peso_nao_entrega;
                return (
                  <li key={i.aluno_id}>
                    <button
                      type="button"
                      onClick={() => onAbrirAluno(i.aluno_id)}
                      className={`${COLUNAS_TURMA} w-full text-left py-2.5 min-h-11 hover:bg-muted/60 tabular-nums`}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-medium text-foreground">{i.aluno_nome}</span>
                        <span className="sm:hidden font-bold shrink-0">{formatarTotal(i.pontuacao)}</span>
                      </span>
                      <span className="sm:hidden block text-xs text-muted-foreground mt-0.5">
                        méritos {formatarComSinal(i.total_merito)} · ocorrências {formatarComSinal(-i.total_infracao)} · {i.faltas_nao_justificadas}{" "}
                        falta(s) {formatarComSinal(faltas)} · {i.atividades_nao_entregues} não entregue(s) {formatarComSinal(naoEntregues)}
                      </span>
                      <span className={`hidden sm:block text-right ${corDoValor(i.total_merito)}`}>{formatarComSinal(i.total_merito)}</span>
                      <span className={`hidden sm:block text-right ${corDoValor(-i.total_infracao)}`}>{formatarComSinal(-i.total_infracao)}</span>
                      <span className="hidden sm:block text-right">
                        <span className="text-xs text-muted-foreground">{i.faltas_nao_justificadas} = </span>
                        <span className={corDoValor(faltas)}>{formatarComSinal(faltas)}</span>
                      </span>
                      <span className="hidden sm:block text-right">
                        <span className="text-xs text-muted-foreground">{i.atividades_nao_entregues} = </span>
                        <span className={corDoValor(naoEntregues)}>{formatarComSinal(naoEntregues)}</span>
                      </span>
                      <span className="hidden sm:block text-right font-bold">{formatarTotal(i.pontuacao)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** A conta do aluno e cada lançamento, separados por tipo. */
function ContaDoAluno({ alunoId, onVerTurma }: { alunoId: number; onVerTurma: () => void }) {
  const [dados, setDados] = useState<{ extrato: Extrato; feirinha: SaldoFeirinha } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [incluirProfessor, setIncluirProfessor] = useState(true);
  const [incluirObservacoes, setIncluirObservacoes] = useState(true);

  useEffect(() => {
    let cancelado = false;
    Promise.all([api.get<Extrato>(`/ranking/extrato/${alunoId}`), api.get<SaldoFeirinha>(`/feirinha/extrato/${alunoId}`)])
      .then(([extrato, feirinha]) => !cancelado && setDados({ extrato, feirinha }))
      .catch((e) => !cancelado && setErro(mensagemErro(e)));
    return () => {
      cancelado = true;
    };
  }, [alunoId]);

  if (erro) return <p className="text-sm text-destructive">{erro}</p>;
  if (!dados) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const { extrato, feirinha } = dados;
  const moedas = pluralMoeda(extrato.nome_moeda);
  const nota = notaFeirinha(extrato.pontuacao);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button variant="outline" onClick={onVerTurma}>
          <ArrowLeft className="size-4" /> Ver turma toda
        </Button>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:ml-auto">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={incluirProfessor} onChange={(e) => setIncluirProfessor(e.target.checked)} className="size-4 accent-primary" />
            Professores no PDF
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={incluirObservacoes} onChange={(e) => setIncluirObservacoes(e.target.checked)} className="size-4 accent-primary" />
            Observações no PDF
          </label>
          <Button variant="outline" onClick={() => gerarPdfExtrato(extrato, feirinha, { incluirProfessor, incluirObservacoes })}>
            <Download className="size-4" /> Baixar extrato (PDF)
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle>{extrato.aluno_nome}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Turma {extrato.turma ?? "-"} · Matrícula {extrato.matricula}
          </p>
        </CardHeader>
        <CardContent className="text-sm tabular-nums">
          <div className="max-w-lg">
            {linhasDaConta(extrato).map((l) => (
              <div key={l.rotulo} className="flex items-baseline justify-between gap-3 py-1.5">
                <span>
                  {l.rotulo} <span className="text-xs text-muted-foreground whitespace-nowrap">({l.detalhe})</span>
                </span>
                <span className={`font-medium ${corDoValor(l.valor)}`}>{formatarComSinal(l.valor)}</span>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-3 py-2 my-1 border-y-2 text-base font-bold">
              <span>{moedas}</span>
              <span>{formatarTotal(extrato.pontuacao)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-1.5">
              <span>Gastou na feirinha</span>
              <span className={`font-medium ${corDoValor(-feirinha.gasto)}`}>{formatarComSinal(-feirinha.gasto)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-1.5 font-bold">
              <span>Disponível na feirinha</span>
              <span>{formatarTotal(feirinha.saldo)}</span>
            </div>
            {nota && <p className="text-xs text-muted-foreground mt-1">{nota}</p>}
          </div>
        </CardContent>
      </Card>

      {secoesDoExtrato(extrato).map((s) => (
        <Card key={s.rotulo}>
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b pb-3">
            <CardTitle>
              {s.rotulo} <span className="text-sm font-normal text-muted-foreground">({s.detalhe})</span>
            </CardTitle>
            <span className={`font-bold tabular-nums shrink-0 ${corDoValor(s.valor)}`}>{formatarComSinal(s.valor)}</span>
          </CardHeader>
          <CardContent className="divide-y text-sm">
            {s.itens.length === 0 ? (
              <p className="text-muted-foreground">Nenhum lançamento.</p>
            ) : (
              s.itens.map((i, indice) => (
                <div key={indice} className="flex items-start justify-between gap-3 py-2 first:pt-0">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground wrap-break-word">{rotuloItem(i.descricao)}</p>
                    <p className="text-xs text-muted-foreground wrap-break-word">
                      {formatarDataSemHora(i.data)}
                      {i.professor_nome ? ` · ${i.professor_nome}` : ""}
                      {i.observacao ? ` · ${i.observacao}` : ""}
                    </p>
                  </div>
                  <span className={`font-semibold tabular-nums shrink-0 ${corDoValor(i.valor)}`}>{formatarComSinal(i.valor)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ExtratoVeracoins({
  turma,
  alunoId,
  onSelecionar,
}: {
  turma: string;
  alunoId: number | "todos" | "";
  onSelecionar: (valor: string) => void;
}) {
  if (!turma || !alunoId) return null;
  // `key` recomeça a consulta do zero ao trocar de turma ou de aluno.
  if (alunoId === "todos") return <ContaDaTurma key={turma} turma={turma} onAbrirAluno={(id) => onSelecionar(String(id))} />;
  return <ContaDoAluno key={alunoId} alunoId={alunoId} onVerTurma={() => onSelecionar("todos")} />;
}
