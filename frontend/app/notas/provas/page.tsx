"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { Atividade, CategoriaAtividade } from "@/lib/types";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function NovaProvaForm({
  turma,
  disciplinaId,
  disciplinaNome,
  categorias,
  recarregarCategorias,
  onCriada,
}: {
  turma: string;
  disciplinaId: number;
  disciplinaNome: string;
  categorias: CategoriaAtividade[];
  recarregarCategorias: () => Promise<void> | void;
  onCriada: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [categoriaId, setCategoriaId] = useState<number | "">("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!categoriaId) return;
    setSalvando(true);
    try {
      await api.post("/atividades", {
        titulo,
        tipo: "prova",
        disciplina_id: disciplinaId,
        turma,
        categoria_id: categoriaId,
        data,
      });
      setTitulo("");
      setCategoriaId("");
      setAberto(false);
      onCriada();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar prova");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <Button onClick={() => setAberto(true)}>
        <Plus />
        Nova prova
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between border-b pb-3">
        <CardTitle>
          Nova prova — Turma {turma} · {disciplinaNome}
        </CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="grid sm:grid-cols-4 gap-3 items-end">
          <CategoriaAtividadeField
            disciplinaId={disciplinaId}
            categorias={categorias}
            categoriaId={categoriaId}
            onSelecionar={setCategoriaId}
            onCategoriaCriada={recarregarCategorias}
            onLimparSelecao={() => setCategoriaId("")}
            colSpanClassName="sm:col-span-2"
          />
          <div className="sm:col-span-2 space-y-1">
            <Label>Título</Label>
            <Input required autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Prova bimestral" />
          </div>
          <div className="space-y-1">
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <Button type="submit" disabled={salvando || !categoriaId} variant="success" className="sm:col-span-4 w-fit">
            {salvando ? "Criando..." : "Criar prova"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ListaProvas({ provas }: { provas: Atividade[] }) {
  if (provas.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Nenhuma prova cadastrada nessa turma ainda.</p>;
  }

  return (
    <Card>
      <ul className="divide-y">
        {provas.map((p) => (
          <li key={p.id}>
            <Link href={`/notas/provas/${p.id}`} className="flex items-center justify-between px-(--card-spacing) py-3 hover:bg-muted/50">
              <div>
                <p className="text-sm font-medium text-foreground">{p.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {p.categoria_nome} · {formatarData(p.data)} · peso {p.categoria_peso}
                </p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">Lançar notas →</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ProvasContent() {
  const { turmas, disciplinasDaTurma } = useAtribuicoes();
  const [turma, setTurma] = useState("");
  const [disciplinaId, setDisciplinaId] = useState<number | "">("");
  const [provas, setProvas] = useState<Atividade[] | null>(null);
  const { categorias, recarregarCategorias } = useCategoriasAtividade(disciplinaId);

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
  }

  async function carregar() {
    if (!turma || !disciplinaId) return;
    const lista = await api.get<Atividade[]>(
      `/atividades?turma=${encodeURIComponent(turma)}&disciplina_id=${disciplinaId}`
    );
    setProvas(lista.filter((a) => a.tipo === "prova"));
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turma, disciplinaId]);

  const disciplinaAtual = disciplinasDisponiveis.find((d) => d.disciplina_id === disciplinaId);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <PageHeader
        title="Provas"
        subtitle="Lance a nota de cada aluno na prova."
        action={
          <div className="flex items-end gap-2">
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
          <NovaProvaForm
            turma={turma}
            disciplinaId={disciplinaId}
            disciplinaNome={disciplinaAtual.disciplina_nome}
            categorias={categorias}
            recarregarCategorias={recarregarCategorias}
            onCriada={carregar}
          />

          {provas === null ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <ListaProvas provas={provas} />
          )}
        </>
      )}
    </div>
  );
}

export default function ProvasPage() {
  return (
    <RequireAuth>
      <ProvasContent />
    </RequireAuth>
  );
}
