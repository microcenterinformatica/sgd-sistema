"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { AtribuicaoRead, Disciplina, ProfessorResumo } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function NovaDisciplinaForm({ onCriada }: { onCriada: () => void }) {
  const [nome, setNome] = useState("");
  const [ehEspecialista, setEhEspecialista] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.post("/disciplinas", { nome, eh_especialista: ehEspecialista });
      setNome("");
      setEhEspecialista(false);
      onCriada();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar disciplina");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-2">
      <div className="flex gap-2 items-end">
        <div className="space-y-1 flex-1">
          <Label>Nova disciplina</Label>
          <Input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: História" />
        </div>
        <Button type="submit" disabled={salvando}>
          <Plus />
          Adicionar
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={ehEspecialista}
          onChange={(e) => setEhEspecialista(e.target.checked)}
          className="size-4 accent-primary"
        />
        Disciplina de especialista (Inglês, Arte, Educação Física, Informática...) — não é dada
        todo dia pelo mesmo professor regente, então tem chamada própria mesmo em turmas de
        Fundamental 1
      </label>
    </form>
  );
}

function ListaDisciplinas({ disciplinas, onAtualizada }: { disciplinas: Disciplina[]; onAtualizada: () => void }) {
  async function excluir(id: number) {
    if (!confirm("Excluir esta disciplina?")) return;
    try {
      await api.delete(`/disciplinas/${id}`);
      onAtualizada();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao excluir");
    }
  }

  async function alternarEspecialista(d: Disciplina) {
    try {
      await api.put(`/disciplinas/${d.id}`, { eh_especialista: !d.eh_especialista });
      onAtualizada();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar disciplina");
    }
  }

  if (disciplinas.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Nenhuma disciplina cadastrada ainda.</p>;
  }

  return (
    <Card>
      <ul className="divide-y">
        {disciplinas.map((d) => (
          <li key={d.id} className="flex items-center justify-between px-(--card-spacing) py-2 gap-3">
            <span className="text-sm text-foreground">{d.nome}</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={d.eh_especialista}
                  onChange={() => alternarEspecialista(d)}
                  className="size-4 accent-primary"
                />
                Especialista
              </label>
              <Button variant="destructive" size="icon-sm" onClick={() => excluir(d.id)} title="Excluir disciplina">
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function NovaAtribuicaoForm({
  professores,
  disciplinas,
  turmas,
  onCriada,
}: {
  professores: ProfessorResumo[];
  disciplinas: Disciplina[];
  turmas: string[];
  onCriada: () => void;
}) {
  const [professorId, setProfessorId] = useState<string>("");
  const [disciplinaId, setDisciplinaId] = useState<string>("");
  const [turma, setTurma] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!professorId || !disciplinaId || !turma) {
      toast.error("Escolha professor, disciplina e turma.");
      return;
    }
    setSalvando(true);
    try {
      await api.post("/atribuicoes", {
        professor_id: Number(professorId),
        disciplina_id: Number(disciplinaId),
        turma,
      });
      setProfessorId("");
      setDisciplinaId("");
      setTurma("");
      onCriada();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar atribuição");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="grid sm:grid-cols-4 gap-3 items-end">
      <div className="space-y-1">
        <Label>Professor</Label>
        <Select value={professorId} onValueChange={(v) => setProfessorId(v ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue>{(v: string) => (v ? professores.find((p) => String(p.id) === v)?.nome : "Selecione...")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {professores.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Disciplina</Label>
        <Select value={disciplinaId} onValueChange={(v) => setDisciplinaId(v ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue>{(v: string) => (v ? disciplinas.find((d) => String(d.id) === v)?.nome : "Selecione...")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {disciplinas.map((d) => (
              <SelectItem key={d.id} value={String(d.id)}>
                {d.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Turma</Label>
        <Select value={turma} onValueChange={(v) => setTurma(v ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue>{(v: string) => (v ? `Turma ${v}` : "Selecione...")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {turmas.map((t) => (
              <SelectItem key={t} value={t}>
                Turma {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={salvar} disabled={salvando} variant="success">
        {salvando ? "Salvando..." : "Atribuir"}
      </Button>
    </div>
  );
}

function ListaAtribuicoes({ atribuicoes, onExcluida }: { atribuicoes: AtribuicaoRead[]; onExcluida: () => void }) {
  async function excluir(id: number) {
    if (!confirm("Remover esta atribuição?")) return;
    try {
      await api.delete(`/atribuicoes/${id}`);
      onExcluida();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao remover");
    }
  }

  if (atribuicoes.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Nenhuma atribuição cadastrada ainda.</p>;
  }

  return (
    <Card>
      <ul className="divide-y">
        {atribuicoes.map((a) => (
          <li key={a.id} className="flex items-center justify-between px-(--card-spacing) py-2">
            <span className="text-sm text-foreground">
              {a.professor_nome} · {a.disciplina_nome} · Turma {a.turma}
            </span>
            <Button variant="destructive" size="icon-sm" onClick={() => excluir(a.id)} title="Remover atribuição">
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DisciplinasContent() {
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [professores, setProfessores] = useState<ProfessorResumo[]>([]);
  const [turmas, setTurmas] = useState<string[]>([]);
  const [atribuicoes, setAtribuicoes] = useState<AtribuicaoRead[]>([]);

  async function carregarDisciplinas() {
    const lista = await api.get<Disciplina[]>("/disciplinas");
    setDisciplinas(lista);
  }

  async function carregarAtribuicoes() {
    const lista = await api.get<AtribuicaoRead[]>("/atribuicoes");
    setAtribuicoes(lista);
  }

  useEffect(() => {
    carregarDisciplinas();
    carregarAtribuicoes();
    api.get<ProfessorResumo[]>("/professores").then(setProfessores);
    api.get<string[]>("/turmas").then(setTurmas);
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <PageHeader
        title="Disciplinas"
        subtitle="Cadastre as disciplinas da escola e defina quais professores lecionam cada uma em cada turma."
      />

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle>Disciplinas cadastradas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <NovaDisciplinaForm onCriada={carregarDisciplinas} />
          <ListaDisciplinas disciplinas={disciplinas} onAtualizada={carregarDisciplinas} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle>Atribuir professor a disciplina e turma</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <NovaAtribuicaoForm
            professores={professores}
            disciplinas={disciplinas}
            turmas={turmas}
            onCriada={carregarAtribuicoes}
          />
          <ListaAtribuicoes atribuicoes={atribuicoes} onExcluida={carregarAtribuicoes} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function DisciplinasPage() {
  return (
    <RequireAuth papeisPermitidos={["admin_escola", "coordenacao"]}>
      <DisciplinasContent />
    </RequireAuth>
  );
}
