"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { SegmentoTurma, Turma } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ROTULO_SEGMENTO: Record<SegmentoTurma, string> = {
  fundamental_1: "Fundamental 1",
  fundamental_2: "Fundamental 2",
};

function SeletorSegmento({
  value,
  onChange,
}: {
  value: SegmentoTurma;
  onChange: (v: SegmentoTurma) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v as SegmentoTurma)}>
      <SelectTrigger className="w-full">
        <SelectValue>{(v: string) => ROTULO_SEGMENTO[v as SegmentoTurma] ?? "Segmento"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="fundamental_1">Fundamental 1</SelectItem>
        <SelectItem value="fundamental_2">Fundamental 2</SelectItem>
      </SelectContent>
    </Select>
  );
}

function NovaTurmaForm({ onCriada }: { onCriada: () => void }) {
  const [nome, setNome] = useState("");
  const [segmento, setSegmento] = useState<SegmentoTurma>("fundamental_2");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.post("/turmas-cadastro", { nome: nome.trim(), segmento });
      setNome("");
      setSegmento("fundamental_2");
      onCriada();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar turma");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="flex gap-2 items-end">
      <div className="space-y-1 flex-1">
        <Label>Nova turma</Label>
        <Input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: 5A" />
      </div>
      <div className="space-y-1 w-44">
        <Label>Segmento</Label>
        <SeletorSegmento value={segmento} onChange={setSegmento} />
      </div>
      <Button type="submit" disabled={salvando}>
        <Plus />
        Adicionar
      </Button>
    </form>
  );
}

function ListaTurmas({ turmas, onExcluida, onAtualizada }: { turmas: Turma[]; onExcluida: () => void; onAtualizada: () => void }) {
  async function excluir(id: number) {
    if (!confirm("Excluir esta turma? Alunos já cadastrados nela não são afetados.")) return;
    try {
      await api.delete(`/turmas-cadastro/${id}`);
      onExcluida();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao excluir");
    }
  }

  async function alterarSegmento(id: number, segmento: SegmentoTurma) {
    try {
      await api.put(`/turmas-cadastro/${id}`, { segmento });
      onAtualizada();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar segmento");
    }
  }

  if (turmas.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Nenhuma turma cadastrada ainda.</p>;
  }

  return (
    <Card>
      <ul className="divide-y">
        {turmas.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 px-(--card-spacing) py-2">
            <span className="text-sm text-foreground">{t.nome}</span>
            <div className="flex items-center gap-2">
              <div className="w-40">
                <SeletorSegmento value={t.segmento} onChange={(v) => alterarSegmento(t.id, v)} />
              </div>
              <Button variant="destructive" size="icon-sm" onClick={() => excluir(t.id)} title="Excluir turma">
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TurmasContent() {
  const [turmas, setTurmas] = useState<Turma[]>([]);

  async function carregar() {
    const lista = await api.get<Turma[]>("/turmas-cadastro");
    setTurmas(lista);
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <PageHeader
        title="Turmas"
        subtitle="Cadastre as turmas da escola para selecioná-las no cadastro de alunos, em vez de digitar toda vez. Marque como Fundamental 1 as turmas em que a mesma professora dá todas as disciplinas e faz apenas uma chamada por dia — a falta registrada passa a valer para todas as disciplinas dela, no mesmo dia."
      />

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle>Turmas cadastradas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <NovaTurmaForm onCriada={carregar} />
          <ListaTurmas turmas={turmas} onExcluida={carregar} onAtualizada={carregar} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function TurmasPage() {
  return (
    <RequireAuth papeisPermitidos={["admin_escola", "coordenacao"]}>
      <TurmasContent />
    </RequireAuth>
  );
}
