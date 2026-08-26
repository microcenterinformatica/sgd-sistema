"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { RankingItem } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const MEDALHAS = ["🥇", "🥈", "🥉"];
const SEM_TURMA = "Sem turma";

interface GrupoRanking {
  turma: string;
  itens: RankingItem[];
}

function detalhe(item: RankingItem): string {
  return `mérito ${item.total_merito} · ocorrências ${item.total_infracao} · ${item.faltas_nao_justificadas} falta(s)`;
}

function LinhaRanking({ item, posicao }: { item: RankingItem; posicao: number }) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <span className="w-8 text-center text-lg">{MEDALHAS[posicao] ?? `${posicao + 1}º`}</span>
        <div>
          <div className="font-medium text-foreground">{item.aluno_nome}</div>
          <div className="text-xs text-muted-foreground">{detalhe(item)}</div>
        </div>
      </div>
      <span className="text-amber-600 font-bold">{item.pontuacao} pts</span>
    </div>
  );
}

function RankingContent() {
  const [itens, setItens] = useState<RankingItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [visao, setVisao] = useState<"turma" | "geral">("turma");
  const [turmaFiltro, setTurmaFiltro] = useState<string>("todas");

  useEffect(() => {
    api
      .get<RankingItem[]>("/ranking")
      .then(setItens)
      .catch((err) => setErro(err instanceof ApiError ? err.message : "Erro ao carregar ranking"));
  }, []);

  const turmasDisponiveis = useMemo(() => {
    if (!itens) return [];
    const unicas = new Set(itens.map((i) => i.turma).filter((t): t is string => !!t));
    return Array.from(unicas).sort();
  }, [itens]);

  const geral = useMemo(() => {
    if (!itens) return null;
    return [...itens].sort((a, b) => b.pontuacao - a.pontuacao);
  }, [itens]);

  const grupos = useMemo<GrupoRanking[] | null>(() => {
    if (!itens) return null;
    const porTurma = new Map<string, RankingItem[]>();
    for (const item of itens) {
      const turma = item.turma ?? SEM_TURMA;
      const lista = porTurma.get(turma) ?? [];
      lista.push(item);
      porTurma.set(turma, lista);
    }
    return Array.from(porTurma.entries())
      .map(([turma, lista]) => ({ turma, itens: lista.sort((a, b) => b.pontuacao - a.pontuacao) }))
      .sort((a, b) => {
        if (a.turma === SEM_TURMA) return 1;
        if (b.turma === SEM_TURMA) return -1;
        return a.turma.localeCompare(b.turma);
      });
  }, [itens]);

  const gruposExibidos = useMemo(() => {
    if (!grupos) return null;
    if (turmaFiltro === "todas") return grupos;
    const turmaAlvo = turmaFiltro === "sem-turma" ? SEM_TURMA : turmaFiltro;
    return grupos.filter((g) => g.turma === turmaAlvo);
  }, [grupos, turmaFiltro]);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Ranking de Mérito"
        subtitle="Pontuação = mérito − ocorrências de indisciplina − (peso × faltas não justificadas)."
        action={
          <div className="flex gap-2">
            <Button
              variant={visao === "turma" ? "default" : "outline"}
              size="sm"
              onClick={() => setVisao("turma")}
            >
              Por turma
            </Button>
            <Button
              variant={visao === "geral" ? "default" : "outline"}
              size="sm"
              onClick={() => setVisao("geral")}
            >
              Geral
            </Button>
          </div>
        }
      />

      {erro && <p className="text-destructive">{erro}</p>}
      {itens === null && !erro && <p className="text-muted-foreground">Carregando...</p>}
      {itens?.length === 0 && <p className="text-muted-foreground">Nenhum aluno cadastrado ainda.</p>}

      {visao === "geral" && geral && geral.length > 0 && (
        <Card className="py-0">
          <CardContent className="divide-y px-0">
            {geral.map((item, idx) => (
              <LinhaRanking key={item.aluno_id} item={item} posicao={idx} />
            ))}
          </CardContent>
        </Card>
      )}

      {visao === "turma" && (
        <>
          {turmasDisponiveis.length > 0 && (
            <Select value={turmaFiltro} onValueChange={(v) => setTurmaFiltro(v ?? "todas")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as turmas</SelectItem>
                {turmasDisponiveis.map((t) => (
                  <SelectItem key={t} value={t}>
                    Turma {t}
                  </SelectItem>
                ))}
                <SelectItem value="sem-turma">Sem turma</SelectItem>
              </SelectContent>
            </Select>
          )}

          {gruposExibidos?.map((grupo) => (
            <div key={grupo.turma} className="space-y-2">
              <h2 className="font-bold text-foreground">
                {grupo.turma === SEM_TURMA ? SEM_TURMA : `Turma ${grupo.turma}`}
              </h2>
              <Card className="py-0">
                <CardContent className="divide-y px-0">
                  {grupo.itens.map((item, idx) => (
                    <LinhaRanking key={item.aluno_id} item={item} posicao={idx} />
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function RankingPage() {
  return (
    <RequireAuth>
      <RankingContent />
    </RequireAuth>
  );
}
