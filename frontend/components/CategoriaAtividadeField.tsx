"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { CategoriaAtividade } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CategoriaAtividadeField({
  disciplinaId,
  categorias,
  categoriaId,
  onSelecionar,
  onCategoriaCriada,
  onLimparSelecao,
  somenteSelecionar = false,
  colSpanClassName = "sm:col-span-full",
}: {
  disciplinaId: number;
  categorias: CategoriaAtividade[];
  categoriaId: number | "";
  onSelecionar: (id: number) => void;
  onCategoriaCriada: () => Promise<void> | void;
  /** Chamado depois de excluir a categoria selecionada, pra limpar a seleção no formulário pai. */
  onLimparSelecao?: () => void;
  /** Quando true, mostra só o seletor — sem criar/editar/excluir categoria (usado nas telas de registrar). */
  somenteSelecionar?: boolean;
  /** Largura do campo (classe de grid-column) quando está só mostrando o seletor. Ignorado no modo criar/editar, que sempre ocupa a linha inteira. */
  colSpanClassName?: string;
}) {
  const [modo, setModo] = useState<"nenhum" | "criar" | "editar">("nenhum");
  const [nome, setNome] = useState("");
  const [peso, setPeso] = useState("1");
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const categoriaSelecionada = categorias.find((c) => c.id === categoriaId);

  function abrirCriar() {
    setNome("");
    setPeso("1");
    setModo("criar");
  }

  function abrirEditar() {
    if (!categoriaSelecionada) return;
    setNome(categoriaSelecionada.nome);
    setPeso(String(categoriaSelecionada.peso));
    setModo("editar");
  }

  async function excluirCategoria() {
    if (!categoriaSelecionada) return;
    if (!confirm(`Excluir a categoria "${categoriaSelecionada.nome}"? Atividades já lançadas nela continuam valendo, mas ela deixa de aparecer pra novas atividades.`)) {
      return;
    }
    setExcluindo(true);
    try {
      await api.delete(`/categorias-atividade/${categoriaSelecionada.id}`);
      toast.success("Categoria excluída.");
      await onCategoriaCriada();
      onLimparSelecao?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao excluir categoria");
    } finally {
      setExcluindo(false);
    }
  }

  async function salvar() {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      if (modo === "criar") {
        const nova = await api.post<CategoriaAtividade>("/categorias-atividade", {
          disciplina_id: disciplinaId,
          nome: nome.trim(),
          peso: Number(peso),
        });
        toast.success("Categoria criada.");
        await onCategoriaCriada();
        onSelecionar(nova.id);
      } else if (modo === "editar" && categoriaSelecionada) {
        await api.put<CategoriaAtividade>(`/categorias-atividade/${categoriaSelecionada.id}`, {
          nome: nome.trim(),
          peso: Number(peso),
        });
        toast.success("Categoria atualizada.");
        await onCategoriaCriada();
      }
      setModo("nenhum");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar categoria");
    } finally {
      setSalvando(false);
    }
  }

  if (!somenteSelecionar && modo !== "nenhum") {
    return (
      <div className="col-span-full space-y-1 rounded-md border p-2">
        <Label>{modo === "criar" ? "Nova categoria" : `Editar categoria "${categoriaSelecionada?.nome}"`}</Label>
        <div className="flex gap-2">
          <Input autoFocus placeholder="Ex: Tarefa de casa" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Input
            type="number"
            step="0.5"
            min="0.5"
            className="w-20"
            title="Peso (pontos na nota final)"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={!nome.trim() || salvando} onClick={salvar}>
            {salvando ? "Salvando..." : modo === "criar" ? "Criar categoria" : "Salvar alterações"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setModo("nenhum")}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${colSpanClassName} space-y-1`}>
      <Label title="Agrupa atividades/provas para o cálculo do boletim. O peso é o cadastrado na categoria e vale para todas as turmas dessa disciplina.">
        Categoria
      </Label>
      <div className="flex flex-wrap gap-1">
        <Select value={categoriaId ? String(categoriaId) : ""} onValueChange={(v) => v && onSelecionar(Number(v))}>
          <SelectTrigger className={somenteSelecionar ? "w-full" : "w-full sm:w-64 sm:flex-none"}>
            <SelectValue>
              {(v: string) => {
                const c = categorias.find((cat) => String(cat.id) === v);
                return c ? `${c.nome} (peso ${c.peso})` : "Selecione...";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categorias.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.nome} (peso {c.peso})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!somenteSelecionar && (
          <Button type="button" size="sm" variant="outline" onClick={abrirCriar}>
            Nova
          </Button>
        )}
        {!somenteSelecionar && categoriaSelecionada && (
          <Button type="button" size="sm" variant="outline" onClick={abrirEditar} title="Editar nome/peso desta categoria">
            Editar
          </Button>
        )}
        {!somenteSelecionar && categoriaSelecionada && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={excluirCategoria}
            disabled={excluindo}
            title="Excluir esta categoria"
          >
            {excluindo ? "Excluindo..." : "Excluir"}
          </Button>
        )}
      </div>
    </div>
  );
}
