"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { CategoriaAtividade } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

function NovaCategoriaForm({ disciplinaId, onCriada }: { disciplinaId: number; onCriada: () => void }) {
  const [nome, setNome] = useState("");
  const [peso, setPeso] = useState("1");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.post("/categorias-atividade", { disciplina_id: disciplinaId, nome: nome.trim(), peso: Number(peso) });
      setNome("");
      setPeso("1");
      toast.success("Categoria criada.");
      onCriada();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar categoria");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-wrap gap-2 items-end">
      <div className="space-y-1 flex-1 min-w-40">
        <Label>Nova categoria</Label>
        <Input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Tarefa de casa" />
      </div>
      <div className="space-y-1 w-24">
        <Label title="Peso na nota final">Peso</Label>
        <Input type="number" step="0.5" min="0.5" value={peso} onChange={(e) => setPeso(e.target.value)} />
      </div>
      <Button type="submit" disabled={salvando}>
        <Plus />
        Adicionar
      </Button>
    </form>
  );
}

function CategoriaItem({ categoria, onAlterada }: { categoria: CategoriaAtividade; onAlterada: () => void }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(categoria.nome);
  const [peso, setPeso] = useState(String(categoria.peso));
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      await api.put(`/categorias-atividade/${categoria.id}`, { nome: nome.trim(), peso: Number(peso) });
      toast.success("Categoria atualizada.");
      setEditando(false);
      onAlterada();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar categoria");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (
      !confirm(
        `Excluir a categoria "${categoria.nome}"? Atividades já lançadas nela continuam valendo, mas ela deixa de aparecer pra novas atividades.`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/categorias-atividade/${categoria.id}`);
      toast.success("Categoria excluída.");
      onAlterada();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao excluir categoria");
    }
  }

  if (editando) {
    return (
      <li className="flex flex-wrap items-end gap-2 py-2">
        <Input className="flex-1 min-w-40" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
        <Input type="number" step="0.5" min="0.5" className="w-20" value={peso} onChange={(e) => setPeso(e.target.value)} />
        <Button size="sm" disabled={salvando || !nome.trim()} onClick={salvar}>
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditando(false)}>
          Cancelar
        </Button>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between py-2">
      <span className="text-sm text-foreground">
        {categoria.nome} <span className="text-muted-foreground">(peso {categoria.peso})</span>
      </span>
      <div className="flex gap-1">
        <Button variant="outline" size="icon-sm" onClick={() => setEditando(true)} title="Editar categoria">
          <Pencil />
        </Button>
        <Button variant="destructive" size="icon-sm" onClick={excluir} title="Excluir categoria">
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

export function GerenciarCategoriasDialog({
  disciplinaId,
  disciplinaNome,
  categorias,
  onAlterada,
}: {
  disciplinaId: number;
  disciplinaNome: string;
  categorias: CategoriaAtividade[];
  onAlterada: () => void;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" />}>
        <Tags />
        Gerenciar categorias
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Categorias — {disciplinaNome}</DialogTitle>
          <DialogDescription>
            Organize suas atividades por categoria (ex: Prova, Tarefa, Trabalho) e defina o peso de cada uma no cálculo da nota final.
          </DialogDescription>
        </DialogHeader>

        <NovaCategoriaForm disciplinaId={disciplinaId} onCriada={onAlterada} />

        {categorias.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Nenhuma categoria cadastrada ainda.</p>
        ) : (
          <ul className="divide-y max-h-64 overflow-y-auto">
            {categorias.map((c) => (
              <CategoriaItem key={c.id} categoria={c} onAlterada={onAlterada} />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
