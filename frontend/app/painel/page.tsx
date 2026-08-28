"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, ClipboardList, Award, TrendingUp, AlertTriangle, PhoneCall } from "lucide-react";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { PainelResumo } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
  const [resumo, setResumo] = useState<PainelResumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      try {
        const r = await api.get<PainelResumo>("/painel/resumo");
        setResumo(r);
      } catch (err) {
        setErro(err instanceof ApiError ? err.message : "Erro ao carregar painel");
      }
    }
    carregar();
  }, []);

  const subtitle =
    resumo?.escopo === "turmas"
      ? resumo.turmas.length > 0
        ? `Suas turmas: ${resumo.turmas.join(", ")}`
        : "Você ainda não tem turmas atribuídas"
      : "Visão geral da disciplina escolar";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader title="Painel" subtitle={subtitle} />

      {erro && <p className="text-destructive">{erro}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resumo === null ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            <StatCard icon={Users} label="Total de alunos" value={resumo.total_alunos} />
            <StatCard
              icon={ClipboardList}
              label="Ocorrências no mês"
              value={resumo.ocorrencias_mes}
              iconClassName="text-destructive bg-destructive/10"
            />
            <StatCard
              icon={Award}
              label="Pontos de mérito no mês"
              value={resumo.pontos_merito_mes}
              iconClassName="text-amber-600 bg-amber-100"
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="size-5" /> Faltas de hoje
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pt-0">
          {resumo === null && <p className="px-6 text-muted-foreground">Carregando...</p>}
          {resumo?.faltas_hoje.length === 0 && (
            <p className="px-6 text-muted-foreground">Nenhuma falta registrada hoje.</p>
          )}
          <ul className="divide-y">
            {resumo?.faltas_hoje.map((f) => (
              <li key={f.aluno_id} className="flex items-center justify-between px-6 py-3 gap-3">
                <div>
                  <Link href={`/alunos/${f.aluno_id}`} className="font-medium text-foreground hover:underline">
                    {f.aluno_nome}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {f.turma ? `Turma ${f.turma}` : "Sem turma"}
                    {f.disciplinas.length > 0 ? ` — ${f.disciplinas.join(", ")}` : ""}
                  </p>
                </div>
                {f.whatsapp_link ? (
                  <a
                    href={f.whatsapp_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "success", size: "sm" })}
                  >
                    Contatar responsável
                  </a>
                ) : (
                  <Badge variant="secondary">Sem WhatsApp cadastrado</Badge>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5" /> Alertas de punição
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pt-0">
          {resumo === null && <p className="px-6 text-muted-foreground">Carregando...</p>}
          {resumo?.alunos_alerta.length === 0 && (
            <p className="px-6 text-muted-foreground">Nenhum aluno em alerta no momento.</p>
          )}
          <ul className="divide-y">
            {resumo?.alunos_alerta.map((a) => (
              <li key={a.aluno_id} className="flex items-center justify-between px-6 py-3 gap-3">
                <div>
                  <Link href={`/alunos/${a.aluno_id}`} className="font-medium text-foreground hover:underline">
                    {a.aluno_nome}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {a.turma ? `Turma ${a.turma} — ` : ""}
                    {a.pontos_atuais} pontos
                  </p>
                </div>
                {a.punicao_atual ? (
                  <Badge variant="destructive">{a.punicao_atual}</Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700">
                    faltam {a.pontos_faltantes} pts para: {a.proxima_punicao}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5" /> Atividade recente
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pt-0">
          {resumo === null && <p className="px-6 text-muted-foreground">Carregando...</p>}
          {resumo?.recentes.length === 0 && <p className="px-6 text-muted-foreground">Nenhum registro ainda.</p>}
          <ul className="divide-y">
            {resumo?.recentes.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <Link href={`/alunos/${r.aluno_id}`} className="font-medium text-foreground hover:underline">
                    {r.aluno_nome}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {r.descricao} — {new Date(r.data_hora).toLocaleString("pt-BR")}
                  </p>
                </div>
                <Badge variant={r.tipo === "infracao" ? "destructive" : "secondary"}>
                  {r.tipo === "infracao" ? "Infração" : "Mérito"}
                </Badge>
              </li>
            ))}
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
