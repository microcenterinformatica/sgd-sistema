"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { calcularStatus } from "@/lib/conduta";
import {
  Aluno,
  AtividadeNaoEntregueRead,
  ConfiguracaoRanking,
  FaltaRead,
  Punicao,
  RegistroDisciplinar,
} from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

type TipoEvento = "infracao" | "merito" | "falta" | "nao_entrega";

interface EventoHistorico {
  key: string;
  data: string;
  tipo: TipoEvento;
  descricao: string;
  peso: number;
  professorNome?: string | null;
  observacao?: string | null;
  registroId?: number;
}

const ROTULO_TIPO_EVENTO: Record<TipoEvento, { label: string; className: string }> = {
  infracao: { label: "Indisciplina", className: "" },
  merito: { label: "Mérito", className: "" },
  falta: { label: "Falta", className: "bg-amber-100 text-amber-700" },
  nao_entrega: { label: "Não entregue", className: "bg-orange-100 text-orange-700" },
};

function BadgeEvento({ tipo }: { tipo: TipoEvento }) {
  const { label, className } = ROTULO_TIPO_EVENTO[tipo];
  if (tipo === "infracao") return <Badge variant="destructive">{label}</Badge>;
  if (tipo === "merito") return <Badge variant="secondary">{label}</Badge>;
  return <Badge className={className}>{label}</Badge>;
}

function formatarDataEvento(evento: EventoHistorico): string {
  if (evento.tipo === "infracao" || evento.tipo === "merito") {
    return new Date(evento.data).toLocaleString("pt-BR");
  }
  // Falta e não entrega só têm data (sem hora). new Date("aaaa-mm-dd") é
  // interpretado como meia-noite UTC, que ao converter pro fuso local pode
  // "voltar" pro dia anterior — por isso formatamos o texto direto, sem
  // passar por Date/toLocaleString.
  const [ano, mes, dia] = evento.data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function HistoricoContent() {
  const { user } = useAuth();
  const podeExcluir = user?.papel === "admin_escola" || user?.papel === "coordenacao";
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [punicoes, setPunicoes] = useState<Punicao[]>([]);
  const [registros, setRegistros] = useState<RegistroDisciplinar[]>([]);
  const [faltas, setFaltas] = useState<FaltaRead[]>([]);
  const [naoEntregues, setNaoEntregues] = useState<AtividadeNaoEntregueRead[]>([]);
  const [configRanking, setConfigRanking] = useState<ConfiguracaoRanking>({ peso_falta: 1, peso_nao_entrega: 0 });
  const [turmaFiltro, setTurmaFiltro] = useState<string>("todas");
  const [buscaNome, setBuscaNome] = useState<string>("");
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    try {
      const [a, p, r, f, n, cfg] = await Promise.all([
        api.get<Aluno[]>("/alunos"),
        api.get<Punicao[]>("/punicoes"),
        api.get<RegistroDisciplinar[]>("/registros"),
        api.get<FaltaRead[]>("/faltas"),
        api.get<AtividadeNaoEntregueRead[]>("/atividades/nao-entregues"),
        api.get<ConfiguracaoRanking>("/configuracao-ranking"),
      ]);
      setAlunos(a.sort((x, y) => x.nome.localeCompare(y.nome)));
      setPunicoes(p);
      setRegistros(r);
      setFaltas(f);
      setNaoEntregues(n);
      setConfigRanking(cfg);
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

  const eventosPorAluno = useMemo(() => {
    const mapa = new Map<number, EventoHistorico[]>();
    function adicionar(alunoId: number, evento: EventoHistorico) {
      const lista = mapa.get(alunoId) ?? [];
      lista.push(evento);
      mapa.set(alunoId, lista);
    }

    for (const r of registros) {
      adicionar(r.aluno_id, {
        key: `registro-${r.id}`,
        data: r.data_hora,
        tipo: r.tipo,
        descricao: r.descricao,
        peso: r.peso,
        professorNome: r.professor_nome,
        observacao: r.observacao,
        registroId: r.id,
      });
    }
    for (const f of faltas) {
      if (f.justificada) continue;
      adicionar(f.aluno_id, {
        key: `falta-${f.id}`,
        data: f.data,
        tipo: "falta",
        descricao: "Falta não justificada",
        peso: configRanking.peso_falta,
      });
    }
    for (const n of naoEntregues) {
      adicionar(n.aluno_id, {
        key: `nao-entrega-${n.aluno_id}-${n.atividade_titulo}-${n.data}`,
        data: n.data,
        tipo: "nao_entrega",
        descricao: `Não entregou: ${n.atividade_titulo} (${n.disciplina_nome})`,
        peso: configRanking.peso_nao_entrega,
      });
    }

    for (const lista of mapa.values()) {
      lista.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    }
    return mapa;
  }, [registros, faltas, naoEntregues, configRanking]);

  const alunosExibidos = useMemo(() => {
    return alunos
      .filter((a) => {
        if (turmaFiltro === "todas") return true;
        if (turmaFiltro === "sem-turma") return !a.turma;
        return a.turma === turmaFiltro;
      })
      .filter((a) => a.nome.toLowerCase().includes(buscaNome.trim().toLowerCase()))
      .sort((x, y) => {
        const diff = (eventosPorAluno.get(y.id)?.length ?? 0) - (eventosPorAluno.get(x.id)?.length ?? 0);
        return diff !== 0 ? diff : x.nome.localeCompare(y.nome);
      });
  }, [alunos, turmaFiltro, buscaNome, eventosPorAluno]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <PageHeader
        title="Histórico de Ocorrências Disciplinares"
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
          const eventos = eventosPorAluno.get(aluno.id) ?? [];
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
                {eventos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem infrações, méritos, faltas ou não entregas registradas.</p>
                ) : (
                  <ul className="divide-y">
                    {eventos.map((evento) => (
                      <li key={evento.key} className="py-2 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <BadgeEvento tipo={evento.tipo} />
                            <p className="text-sm font-medium text-foreground">{evento.descricao}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatarDataEvento(evento)}
                            {evento.professorNome ? ` — Professor(a): ${evento.professorNome}` : ""}
                            {evento.observacao ? ` — ${evento.observacao}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${evento.peso >= 0 ? "text-destructive" : "text-emerald-600"}`}>
                            {evento.peso >= 0 ? `+${evento.peso}` : evento.peso}
                          </span>
                          {podeExcluir && evento.registroId !== undefined && (
                            <ConfirmDialog
                              trigger={
                                <Button variant="ghost" size="sm" className="text-destructive">
                                  Excluir
                                </Button>
                              }
                              title="Excluir registro?"
                              description={`Isso removerá "${evento.descricao}" do histórico de ${aluno.nome} e recalculará a pontuação dele. Essa ação não pode ser desfeita.`}
                              confirmLabel="Excluir"
                              onConfirm={() => excluirRegistro(evento.registroId as number)}
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
