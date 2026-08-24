"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { CategoriaAtividade } from "./types";

export function useCategoriasAtividade(disciplinaId: number | "") {
  const [categorias, setCategorias] = useState<CategoriaAtividade[]>([]);

  const recarregar = useCallback(async () => {
    if (!disciplinaId) {
      setCategorias([]);
      return;
    }
    const lista = await api.get<CategoriaAtividade[]>(`/categorias-atividade?disciplina_id=${disciplinaId}`);
    setCategorias(lista);
  }, [disciplinaId]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { categorias, recarregarCategorias: recarregar };
}
