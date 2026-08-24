"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, ClipboardList, Award, TrendingUp } from "lucide-react";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { Aluno, RegistroDisciplinar } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({
  icon: Icon,
  label,
  value,
  iconClassName,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  iconClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className={`rounded-full p-3 bg-primary/10 ${iconClassName ?? "text-primary"}`}>
          <Icon className="size-6" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardContent() {
  const [alunos, setAlunos] = useState<Aluno[] | null>(null);
  const [registros, setRegistros] = useState<RegistroDisciplinar[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      try {
        const [a, r] = await Promise.all([
          api.get<Aluno[]>("/alunos"),
          api.get<RegistroDisciplinar[]>("/registros"),
        ]);
        setAlunos(a);
        setRegistros(r);
      } catch (err) {
        setErro(err instanceof ApiError ? err.message : "Erro ao carregar painel");
      }
    }
    carregar();
  }, []);

  const alunosPorId = useMemo(() => new Map((alunos ?? []).map((a) => [a.id, a])), [alunos]);

  const stats = useMemo(() => {
    if (!registros) return null;
    const agora = new Date();
    const mesAtual = agora.getMonth();
    const anoAtual = agora.getFullYear();

    const doMes = registros.filter((r) => {
      const d = new Date(r.data_hora);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });

    const ocorrenciasNoMes = doMes.filter((r) => r.tipo === "infracao").length;
    const pontosMeritoNoMes = doMes
      .filter((r) => r.tipo === "merito")
      .reduce((soma, r) => soma + Math.abs(r.peso), 0);

    return { ocorrenciasNoMes, pontosMeritoNoMes };
  }, [registros]);

  const recentes = useMemo(() => {
    if (!registros) return [];
    return [...registros].sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime()).slice(0, 8);
  }, [registros]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader title="Painel" subtitle="Visão geral da disciplina escolar" />

      {erro && <p className="text-destructive">{erro}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {alunos === null || stats === null ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            <StatCard icon={Users} label="Total de alunos" value={alunos.length} />
            <StatCard
              icon={ClipboardList}
              label="Ocorrências no mês"
              value={stats.ocorrenciasNoMes}
              iconClassName="text-destructive bg-destructive/10"
            />
            <StatCard
              icon={Award}
              label="Pontos de mérito no mês"
              value={stats.pontosMeritoNoMes}
              iconClassName="text-amber-600 bg-amber-100"
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5" /> Atividade recente
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pt-0">
          {registros === null && <p className="px-6 text-muted-foreground">Carregando...</p>}
          {registros?.length === 0 && <p className="px-6 text-muted-foreground">Nenhum registro ainda.</p>}
          <ul className="divide-y">
            {recentes.map((r) => {
              const aluno = alunosPorId.get(r.aluno_id);
              return (
                <li key={r.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <Link href={`/alunos/${r.aluno_id}`} className="font-medium text-foreground hover:underline">
                      {aluno?.nome ?? "Aluno"}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {r.descricao} — {new Date(r.data_hora).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <Badge variant={r.tipo === "infracao" ? "destructive" : "secondary"}>
                    {r.tipo === "infracao" ? "Infração" : "Mérito"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
