"use client";

import { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { Aluno, RegistroDisciplinar } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MEDALHAS = ["🥇", "🥈", "🥉"];

interface ItemRanking {
  alunoId: number;
  nome: string;
  totalMerito: number;
}

interface GrupoRanking {
  turma: string;
  itens: ItemRanking[];
}

const SEM_TURMA = "Sem turma";

function RankingContent() {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [grupos, setGrupos] = useState<GrupoRanking[] | null>(null);
  const [turmaFiltro, setTurmaFiltro] = useState<string>("todas");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      try {
        const [alunosCarregados, registros] = await Promise.all([
          api.get<Aluno[]>("/alunos"),
          api.get<RegistroDisciplinar[]>("/registros"),
        ]);
        setAlunos(alunosCarregados);

        const alunosPorId = new Map(alunosCarregados.map((a) => [a.id, a]));
        const totais = new Map<number, number>();
        for (const r of registros) {
          if (r.tipo !== "merito") continue;
          totais.set(r.aluno_id, (totais.get(r.aluno_id) ?? 0) + Math.abs(r.peso));
        }

        const porTurma = new Map<string, ItemRanking[]>();
        for (const [alunoId, totalMerito] of totais.entries()) {
          const aluno = alunosPorId.get(alunoId);
          const turma = aluno?.turma ?? SEM_TURMA;
          const lista = porTurma.get(turma) ?? [];
          lista.push({ alunoId, nome: aluno?.nome ?? "?", totalMerito });
          porTurma.set(turma, lista);
        }

        const listaGrupos = Array.from(porTurma.entries())
          .map(([turma, itens]) => ({ turma, itens: itens.sort((a, b) => b.totalMerito - a.totalMerito) }))
          .sort((a, b) => {
            if (a.turma === SEM_TURMA) return 1;
            if (b.turma === SEM_TURMA) return -1;
            return a.turma.localeCompare(b.turma);
          });

        setGrupos(listaGrupos);
      } catch (err) {
        setErro(err instanceof ApiError ? err.message : "Erro ao carregar ranking");
      }
    }
    carregar();
  }, []);

  const turmasDisponiveis = useMemo(() => {
    const unicas = new Set(alunos.map((a) => a.turma).filter((t): t is string => !!t));
    return Array.from(unicas).sort();
  }, [alunos]);

  const gruposExibidos = useMemo(() => {
    if (!grupos) return null;
    if (turmaFiltro === "todas") return grupos;
    const turmaAlvo = turmaFiltro === "sem-turma" ? SEM_TURMA : turmaFiltro;
    return grupos.filter((g) => g.turma === turmaAlvo);
  }, [grupos, turmaFiltro]);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Ranking de Mérito por Turma"
        subtitle="Soma dos pontos de mérito recebidos por cada aluno, separado por turma."
        action={
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
        }
      />

      {erro && <p className="text-destructive">{erro}</p>}
      {gruposExibidos === null && <p className="text-muted-foreground">Carregando...</p>}
      {gruposExibidos?.length === 0 && <p className="text-muted-foreground">Nenhum mérito registrado ainda.</p>}

      {gruposExibidos?.map((grupo) => (
        <div key={grupo.turma} className="space-y-2">
          <h2 className="font-bold text-foreground">
            {grupo.turma === SEM_TURMA ? SEM_TURMA : `Turma ${grupo.turma}`}
          </h2>
          <Card className="py-0">
            <CardContent className="divide-y px-0">
              {grupo.itens.map((item, idx) => (
                <div key={item.alunoId} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-center text-lg">{MEDALHAS[idx] ?? `${idx + 1}º`}</span>
                    <span className="font-medium text-foreground">{item.nome}</span>
                  </div>
                  <span className="text-amber-600 font-bold">{item.totalMerito} pts de mérito</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ))}
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
