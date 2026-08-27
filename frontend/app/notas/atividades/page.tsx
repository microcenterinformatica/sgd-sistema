"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { Aluno, Atividade, AtividadeResumoItem, BoletimAluno, CategoriaAtividade, Punicao } from "@/lib/types";
import {
  escolherDisciplinaInicial,
  escolherTurmaInicial,
  salvarUltimaDisciplina,
  salvarUltimaTurma,
} from "@/lib/turmaPreferida";
import { useAtribuicoes } from "@/lib/useAtribuicoes";
import { useCategoriasAtividade } from "@/lib/useCategoriasAtividade";
import { PageHeader } from "@/components/PageHeader";
import { CategoriaAtividadeField } from "@/components/CategoriaAtividadeField";
import { AtividadesResumoCard } from "@/components/AtividadesResumoCard";
import { BoletimTurmaCard } from "@/components/BoletimTurmaCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function NovaAtividadeForm({
  turma,
  disciplinaId,
  disciplinaNome,
  categorias,
  onCriada,
}: {
  turma: string;
  disciplinaId: number;
  disciplinaNome: string;
  categorias: CategoriaAtividade[];
  onCriada: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [categoriaId, setCategoriaId] = useState<number | "">("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [dataEntrega, setDataEntrega] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!categoriaId) return;
    setSalvando(true);
    try {
      await api.post("/atividades", {
        titulo,
        tipo: "atividade",
        disciplina_id: disciplinaId,
        turma,
        categoria_id: categoriaId,
        data,
        data_entrega: dataEntrega || null,
      });
      setTitulo("");
      setCategoriaId("");
      setDataEntrega("");
      setAberto(false);
      onCriada();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar atividade");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <Button onClick={() => setAberto(true)}>
        <Plus />
        Nova atividade
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between border-b pb-3">
        <CardTitle>
          Nova atividade — Turma {turma} · {disciplinaNome}
        </CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="space-y-4">
          <div className="space-y-1">
            <Label className="text-base">Título da atividade</Label>
            <Input
              required
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Lista de exercícios 3"
              className="text-base h-11"
            />
          </div>

          <CategoriaAtividadeField categorias={categorias} categoriaId={categoriaId} onSelecionar={setCategoriaId} />

          <Button type="submit" disabled={salvando || !categoriaId} variant="success" size="lg">
            {salvando ? "Criando..." : "Criar atividade"}
          </Button>

          <div className="grid grid-cols-2 gap-3 max-w-sm pt-2 border-t">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data de entrega</Label>
              <Input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ListaAtividades({ atividades }: { atividades: Atividade[] }) {
  if (atividades.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Nenhuma atividade cadastrada nessa turma ainda.</p>;
  }

  return (
    <Card>
      <ul className="divide-y">
        {atividades.map((a) => (
          <li key={a.id}>
            <Link href={`/notas/atividades/${a.id}`} className="flex items-center justify-between px-(--card-spacing) py-3 hover:bg-muted/50">
              <div>
                <p className="text-sm font-medium text-foreground">{a.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {a.categoria_nome} · {formatarData(a.data)} · peso {a.categoria_peso}
                  {a.data_entrega && <> · entrega até {formatarData(a.data_entrega)}</>}
                </p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">Registrar →</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AtividadesContent() {
  const { turmas, disciplinasDaTurma } = useAtribuicoes();
  const [turma, setTurma] = useState("");
  const [disciplinaId, setDisciplinaId] = useState<number | "">("");
  const { categorias } = useCategoriasAtividade(disciplinaId);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<number | "todas">("todas");
  const [atividades, setAtividades] = useState<Atividade[] | null>(null);
  const [resumo, setResumo] = useState<AtividadeResumoItem[] | null>(null);
  const [boletim, setBoletim] = useState<BoletimAluno[]>([]);
  const [alunosCompletos, setAlunosCompletos] = useState<Aluno[]>([]);
  const [punicoes, setPunicoes] = useState<Punicao[]>([]);

  useEffect(() => {
    api.get<Punicao[]>("/punicoes").then(setPunicoes).catch(() => {});
  }, []);

  const alunosCompletosPorId = new Map(alunosCompletos.map((a) => [a.id, a]));

  useEffect(() => {
    if (turmas.length === 0) return;
    setTurma((atual) => (atual && turmas.includes(atual) ? atual : escolherTurmaInicial(turmas)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmas]);

  const disciplinasDisponiveis = turma ? disciplinasDaTurma(turma) : [];

  useEffect(() => {
    if (disciplinasDisponiveis.length === 0) {
      setDisciplinaId("");
      return;
    }
    const ids = disciplinasDisponiveis.map((d) => d.disciplina_id);
    setDisciplinaId((atual) => (atual && ids.includes(atual) ? atual : escolherDisciplinaInicial(ids)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turma, disciplinasDisponiveis.length]);

  function selecionarTurma(t: string) {
    setTurma(t);
    salvarUltimaTurma(t);
  }

  function selecionarDisciplina(id: number) {
    setDisciplinaId(id);
    salvarUltimaDisciplina(id);
    setCategoriaFiltro("todas");
  }

  const atividadesExibidas =
    atividades === null
      ? null
      : categoriaFiltro === "todas"
        ? atividades
        : atividades.filter((a) => a.categoria_id === categoriaFiltro);

  async function carregar() {
    if (!turma || !disciplinaId) return;
    const params = new URLSearchParams({ turma, disciplina_id: String(disciplinaId) });
    if (dataInicio) params.set("data_inicio", dataInicio);
    if (dataFim) params.set("data_fim", dataFim);
    const [listaAtividades, listaResumo, listaBoletim, listaAlunos] = await Promise.all([
      api.get<Atividade[]>(`/atividades?${params.toString()}`),
      api.get<AtividadeResumoItem[]>(`/atividades/resumo?turma=${encodeURIComponent(turma)}&disciplina_id=${disciplinaId}`),
      api.get<BoletimAluno[]>(`/boletim?${params.toString()}`),
      api.get<Aluno[]>("/alunos"),
    ]);
    setAtividades(listaAtividades.filter((a) => a.tipo !== "prova"));
    setResumo(listaResumo);
    setBoletim(listaBoletim);
    setAlunosCompletos(listaAlunos);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turma, disciplinaId, dataInicio, dataFim]);

  const disciplinaAtual = disciplinasDisponiveis.find((d) => d.disciplina_id === disciplinaId);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <PageHeader
        title="Registro de Atividades"
        subtitle="Registre se o aluno fez ou não fez cada atividade."
        action={
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Período de</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-36" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">até</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-36" />
            </div>
            <Select value={turma} onValueChange={(v) => v && selecionarTurma(v)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue>{(v: string) => (v ? `Turma ${v}` : "Turma")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {turmas.map((t) => (
                  <SelectItem key={t} value={t}>
                    Turma {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={disciplinaId ? String(disciplinaId) : ""} onValueChange={(v) => v && selecionarDisciplina(Number(v))}>
              <SelectTrigger className="w-[160px]">
                <SelectValue>
                  {(v: string) => (v ? disciplinasDisponiveis.find((d) => String(d.disciplina_id) === v)?.disciplina_nome : "Disciplina")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {disciplinasDisponiveis.map((d) => (
                  <SelectItem key={d.disciplina_id} value={String(d.disciplina_id)}>
                    {d.disciplina_nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categorias.length > 0 && (
              <Select
                value={categoriaFiltro === "todas" ? "todas" : String(categoriaFiltro)}
                onValueChange={(v) => setCategoriaFiltro(!v || v === "todas" ? "todas" : Number(v))}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue>
                    {(v: string) => (v === "todas" || !v ? "Todas as categorias" : categorias.find((c) => String(c.id) === v)?.nome)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as categorias</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        }
      />

      {turma && disciplinasDisponiveis.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Você não tem nenhuma disciplina atribuída nessa turma. Fale com a coordenação.
        </p>
      )}

      {turma && disciplinaId && disciplinaAtual && (
        <>
          <NovaAtividadeForm
            turma={turma}
            disciplinaId={disciplinaId}
            disciplinaNome={disciplinaAtual.disciplina_nome}
            categorias={categorias}
            onCriada={carregar}
          />

          {atividades === null ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <ListaAtividades atividades={atividadesExibidas ?? []} />
          )}

          {resumo && <AtividadesResumoCard resumo={resumo} />}

          <BoletimTurmaCard boletim={boletim} alunosCompletosPorId={alunosCompletosPorId} punicoes={punicoes} />
        </>
      )}
    </div>
  );
}

export default function AtividadesPage() {
  return (
    <RequireAuth>
      <AtividadesContent />
    </RequireAuth>
  );
}
