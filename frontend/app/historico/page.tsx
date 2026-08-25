"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Aluno, Punicao, RegistroDisciplinar } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function calcularStatus(pontos: number, punicoes: Punicao[]): string {
  const aplicaveis = punicoes
    .filter((p) => p.ativo && pontos >= p.pontuacao_minima)
    .sort((a, b) => b.pontuacao_minima - a.pontuacao_minima);
  return aplicaveis[0]?.descricao ?? "Sem conduta";
}

function HistoricoContent() {
  const { user } = useAuth();
  const podeExcluir = user?.papel === "admin_escola" || user?.papel === "coordenacao";
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [punicoes, setPunicoes] = useState<Punicao[]>([]);
  const [registros, setRegistros] = useState<RegistroDisciplinar[]>([]);
  const [turmaFiltro, setTurmaFiltro] = useState<string>("todas");
  const [buscaNome, setBuscaNome] = useState<string>("");
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    try {
      const [a, p, r] = await Promise.all([
        api.get<Aluno[]>("/alunos"),
        api.get<Punicao[]>("/punicoes"),
        api.get<RegistroDisciplinar[]>("/registros"),
      ]);
      setAlunos(a.sort((x, y) => x.nome.localeCompare(y.nome)));
      setPunicoes(p);
      setRegistros(r);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao carregar histórico");
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function excluirRegistro(id: number) {
    try {
      await api.delete(`/registros/${id}`);
      await carregar();
      toast.success("Registro excluído");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao excluir registro");
    }
  }

  const turmas = useMemo(() => {
    const unicas = new Set(alunos.map((a) => a.turma).filter((t): t is string => !!t));
    return Array.from(unicas).sort();
  }, [alunos]);

  const alunosExibidos = useMemo(() => {
    return alunos
      .filter((a) => {
        if (turmaFiltro === "todas") return true;
        if (turmaFiltro === "sem-turma") return !a.turma;
        return a.turma === turmaFiltro;
      })
      .filter((a) => a.nome.toLowerCase().includes(buscaNome.trim().toLowerCase()));
  }, [alunos, turmaFiltro, buscaNome]);

  const registrosPorAluno = useMemo(() => {
    const mapa = new Map<number, RegistroDisciplinar[]>();
    for (const r of registros) {
      const lista = mapa.get(r.aluno_id) ?? [];
      lista.push(r);
      mapa.set(r.aluno_id, lista);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime());
    }
    return mapa;
  }, [registros]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <PageHeader
        title="Histórico de Infrações e Méritos"
        action={
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              value={buscaNome}
              onChange={(e) => setBuscaNome(e.target.value)}
              placeholder="Buscar por nome..."
              className="w-48"
            />
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
                <SelectItem value="sem-turma">Sem turma</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {erro && <p className="text-destructive">{erro}</p>}

      {alunosExibidos.length === 0 && <p className="text-muted-foreground">Nenhum aluno encontrado.</p>}

      <div className="space-y-4">
        {alunosExibidos.map((aluno) => {
          const historico = registrosPorAluno.get(aluno.id) ?? [];
          return (
            <Card key={aluno.id}>
              <CardHeader className="flex-row items-center justify-between border-b pb-3">
                <div>
                  <p className="font-semibold text-foreground">
                    {aluno.nome}{" "}
                    <span className="text-muted-foreground font-normal">
                      ({aluno.matricula}{aluno.turma ? ` — Turma ${aluno.turma}` : ""})
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">Status atual: {calcularStatus(aluno.pontos_atuais, punicoes)}</p>
                </div>
                <span className="text-sm font-semibold px-3 py-1 rounded-full bg-primary text-primary-foreground">
                  {aluno.pontos_atuais} pontos
                </span>
              </CardHeader>
              <CardContent>
                {historico.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem infrações ou méritos registrados.</p>
                ) : (
                  <ul className="divide-y">
                    {historico.map((r) => (
                      <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{r.descricao}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(r.data_hora).toLocaleString("pt-BR")}
                            {r.professor_nome ? ` — Professor(a): ${r.professor_nome}` : ""}
                            {r.observacao ? ` — ${r.observacao}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${r.peso >= 0 ? "text-destructive" : "text-emerald-600"}`}>
                            {r.peso >= 0 ? `+${r.peso}` : r.peso}
                          </span>
                          {podeExcluir && (
                            <ConfirmDialog
                              trigger={
                                <Button variant="ghost" size="sm" className="text-destructive">
                                  Excluir
                                </Button>
                              }
                              title="Excluir registro?"
                              description={`Isso removerá "${r.descricao}" do histórico de ${aluno.nome} e recalculará a pontuação dele. Essa ação não pode ser desfeita.`}
                              confirmLabel="Excluir"
                              onConfirm={() => excluirRegistro(r.id)}
                            />
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function HistoricoPage() {
  return (
    <RequireAuth>
      <HistoricoContent />
    </RequireAuth>
  );
}
