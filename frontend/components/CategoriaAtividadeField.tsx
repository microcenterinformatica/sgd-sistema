"use client";

import { CategoriaAtividade } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CategoriaAtividadeField({
  categorias,
  categoriaId,
  onSelecionar,
  colSpanClassName = "sm:col-span-full",
}: {
  categorias: CategoriaAtividade[];
  categoriaId: number | "";
  onSelecionar: (id: number) => void;
  /** Largura do campo (classe de grid-column). */
  colSpanClassName?: string;
}) {
  return (
    <div className={`${colSpanClassName} space-y-1`}>
      <Label title="Agrupa atividades/provas para o cálculo do boletim. O peso é o cadastrado na categoria (tela Categorias) e vale para todas as turmas dessa disciplina.">
        Categoria
      </Label>
      <Select value={categoriaId ? String(categoriaId) : ""} onValueChange={(v) => v && onSelecionar(Number(v))}>
        <SelectTrigger className="w-full">
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
    </div>
  );
}
