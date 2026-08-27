"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAtribuicoes } from "@/lib/useAtribuicoes";
import { Aluno } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";

function ColunaOrdenavel({ label, column }: { label: string; column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) {
  return (
    <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-3">
      {label}
      <ArrowUpDown className="ml-1 size-3.5" />
    </Button>
  );
}

function pontosVariant(pontos: number): "secondary" | "outline" | "destructive" {
  if (pontos === 0) return "secondary";
  if (pontos < 6) return "outline";
  return "destructive";
}

const columns: ColumnDef<Aluno>[] = [
  {
    accessorKey: "nome",
    header: ({ column }) => <ColunaOrdenavel label="Nome" column={column} />,
    cell: ({ row }) => (
      <Link href={`/alunos/${row.original.id}`} className="font-medium text-foreground hover:underline">
        {row.original.nome}
      </Link>
    ),
  },
  {
    accessorKey: "numero_chamada",
    header: ({ column }) => <ColunaOrdenavel label="Nº chamada" column={column} />,
    cell: ({ row }) => row.original.numero_chamada ?? <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "turma",
    header: ({ column }) => <ColunaOrdenavel label="Turma" column={column} />,
    cell: ({ row }) => row.original.turma ?? <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "pontos_atuais",
    header: ({ column }) => <ColunaOrdenavel label="Pontos" column={column} />,
    cell: ({ row }) => <Badge variant={pontosVariant(row.original.pontos_atuais)}>{row.original.pontos_atuais} pontos</Badge>,
  },
  {
    id: "acoes",
    header: "",
    cell: ({ row }) => (
      <Button size="sm" render={<Link href={`/alunos/${row.original.id}#registrar`} />}>
        Registrar
      </Button>
    ),
  },
];

function AlunosContent() {
  const { user } = useAuth();
  const { dados: atribuicoes, turmas: turmasDoProfessor } = useAtribuicoes();
  const [alunos, setAlunos] = useState<Aluno[] | null>(null);
  const [turmaFiltro, setTurmaFiltro] = useState("todas");
  const [erro, setErro] = useState<string | null>(null);

  const restritoPorTurma = user?.papel === "professor" && atribuicoes !== null && !atribuicoes.acesso_total;

  async function carregar() {
    try {
      const dados = await api.get<Aluno[]>("/alunos");
      setAlunos(dados.sort((a, b) => a.nome.localeCompare(b.nome)));
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao carregar alunos");
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const alunosVisiveis = useMemo(() => {
    if (!alunos) return [];
    if (!restritoPorTurma) return alunos;
    return alunos.filter((a) => a.turma && turmasDoProfessor.includes(a.turma));
  }, [alunos, restritoPorTurma, turmasDoProfessor]);

  const turmas = useMemo(() => {
    const unicas = new Set(alunosVisiveis.map((a) => a.turma).filter((t): t is string => !!t));
    return Array.from(unicas).sort();
  }, [alunosVisiveis]);

  const alunosFiltrados = useMemo(() => {
    if (turmaFiltro === "todas") return alunosVisiveis;
    if (turmaFiltro === "sem-turma") return alunosVisiveis.filter((a) => !a.turma);
    return alunosVisiveis.filter((a) => a.turma === turmaFiltro);
  }, [alunosVisiveis, turmaFiltro]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader
        title="Registro de Ocorrências"
        subtitle="Encontre o aluno na tabela abaixo e clique em “Registrar” para lançar uma infração ou mérito."
        action={
          <Select value={turmaFiltro} onValueChange={(v) => setTurmaFiltro(v ?? "todas")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as turmas</SelectItem>
              {turmas.map((t) => (
                <SelectItem key={t} value={t}>
                  Turma {t}
                </SelectItem>
              ))}
              {!restritoPorTurma && <SelectItem value="sem-turma">Sem turma</SelectItem>}
            </SelectContent>
          </Select>
        }
      />

      {erro && <p className="text-destructive">{erro}</p>}

      {alunos === null ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <DataTable columns={columns} data={alunosFiltrados} searchPlaceholder="Buscar aluno por nome..." emptyMessage="Nenhum aluno encontrado." />
      )}
    </div>
  );
}

export default function AlunosPage() {
  return (
    <RequireAuth>
      <AlunosContent />
    </RequireAuth>
  );
}
