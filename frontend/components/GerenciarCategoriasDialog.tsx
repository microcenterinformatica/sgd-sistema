"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tags, Lock } from "lucide-react";
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

function NovaCategoriaForm({
  disciplinaId,
  permiteConduta,
  onCriada,
}: {
  disciplinaId: number;
  /** Falso quando a professora já tem uma categoria de conduta nesta disciplina. */
  permiteConduta: boolean;
  onCriada: () => void;
}) {
  const [nome, setNome] = useState("");
  const [peso, setPeso] = useState("1");
  const [conduta, setConduta] = useState(false);
  const [desconto, setDesconto] = useState("0.5");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.post("/categorias-atividade", {
        disciplina_id: disciplinaId,
        nome: nome.trim(),
        peso: Number(peso),
        tipo: conduta ? "conduta" : "manual",
        desconto_por_ponto: conduta ? Number(desconto) : null,
      });
      setNome("");
      setPeso("1");
      setConduta(false);
      setDesconto("0.5");
      toast.success("Categoria criada.");
      onCriada();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar categoria");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-2">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="space-y-1 flex-1 min-w-40">
          <Label>Nova categoria</Label>
          <Input
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={conduta ? "Ex: Comportamento" : "Ex: Tarefa de casa"}
          />
        </div>
        <div className="space-y-1 w-24">
          <Label title="Peso na nota final">Peso</Label>
          <Input type="number" step="0.5" min="0.5" value={peso} onChange={(e) => setPeso(e.target.value)} />
        </div>
        <Button type="submit" disabled={salvando}>
          <Plus />
          Adicionar
        </Button>
      </div>
      {permiteConduta && (
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={conduta}
            onChange={(e) => setConduta(e.target.checked)}
            className="size-4 accent-primary"
          />
          Nota automática de conduta (ligada ao Patrimônio Disciplinar)
        </label>
      )}
      {conduta && (
        <div className="rounded-md bg-muted p-3 space-y-2 text-xs text-muted-foreground">
          <p>
            Todo aluno começa cada trimestre com nota 10 nesta categoria. Cada ponto de indisciplina registrado no
            trimestre desconta o valor abaixo, e o mérito devolve (sem passar de 10). Faltas e não entregas não contam.
            Não é preciso lançar atividades nela.
          </p>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-foreground">Desconto por ponto de indisciplina</Label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              className="w-20 h-8"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
            />
          </div>
        </div>
      )}
    </form>
  );
}

function CategoriaItem({ categoria, onAlterada }: { categoria: CategoriaAtividade; onAlterada: () => void }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(categoria.nome);
  const [peso, setPeso] = useState(String(categoria.peso));
  const [desconto, setDesconto] = useState(String(categoria.desconto_por_ponto ?? 0.5));
  const [salvando, setSalvando] = useState(false);
  const ehConduta = categoria.tipo === "conduta";

  async function salvar() {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      await api.put(`/categorias-atividade/${categoria.id}`, {
        nome: nome.trim(),
        peso: Number(peso),
        ...(ehConduta ? { desconto_por_ponto: Number(desconto) } : {}),
      });
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
        {ehConduta && (
          <Input
            type="number"
            step="0.1"
            min="0.1"
            max="10"
            className="w-20"
            title="Desconto por ponto de indisciplina"
            value={desconto}
            onChange={(e) => setDesconto(e.target.value)}
          />
        )}
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
        {ehConduta && <Lock className="inline size-3.5 mr-1 -mt-0.5 text-muted-foreground" />}
        {categoria.nome} <span className="text-muted-foreground">(peso {categoria.peso})</span>
        {ehConduta && (
          <span className="block text-xs text-muted-foreground">
            Conduta automática · desconta {categoria.desconto_por_ponto?.toLocaleString("pt-BR")} por ponto
          </span>
        )}
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

        <NovaCategoriaForm
          disciplinaId={disciplinaId}
          permiteConduta={!categorias.some((c) => c.tipo === "conduta")}
          onCriada={onAlterada}
        />

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
