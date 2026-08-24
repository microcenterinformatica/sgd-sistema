"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { AlunoResumo, Atividade, LancamentoRead } from "@/lib/types";
import { useCategoriasAtividade } from "@/lib/useCategoriasAtividade";
import { PageHeader } from "@/components/PageHeader";
import { CategoriaAtividadeField } from "@/components/CategoriaAtividadeField";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ProvaDetalheContent() {
  const params = useParams<{ id: string }>();
  const provaId = Number(params.id);
  const router = useRouter();

  const [prova, setProva] = useState<Atividade | null>(null);
  const [alunos, setAlunos] = useState<AlunoResumo[]>([]);
  const [notas, setNotas] = useState<Record<number, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);

  const [editando, setEditando] = useState(false);
  const [tituloEdit, setTituloEdit] = useState("");
  const [categoriaIdEdit, setCategoriaIdEdit] = useState<number | "">("");
  const [dataEdit, setDataEdit] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const { categorias, recarregarCategorias } = useCategoriasAtividade(prova?.disciplina_id ?? "");

  useEffect(() => {
    async function carregar() {
      try {
        const [atividades, listaAlunos, lancamentos] = await Promise.all([
          api.get<Atividade[]>("/atividades"),
          api.get<AlunoResumo[]>(`/atividades/${provaId}/alunos-turma`),
          api.get<LancamentoRead[]>(`/atividades/${provaId}/lancamentos`),
        ]);
        const atual = atividades.find((a) => a.id === provaId) ?? null;
        setProva(atual);
        setAlunos(listaAlunos);

        const notasCarregadas: Record<number, string> = {};
        for (const l of lancamentos) {
          if (l.nota !== null) notasCarregadas[l.aluno_id] = String(l.nota);
        }
        setNotas(notasCarregadas);
      } catch (err) {
        setErroCarregar(err instanceof ApiError ? err.message : "Erro ao carregar prova");
      }
    }
    carregar();
  }, [provaId]);

  function abrirEdicao() {
    if (!prova) return;
    setTituloEdit(prova.titulo);
    setCategoriaIdEdit(prova.categoria_id);
    setDataEdit(prova.data);
    setEditando(true);
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!categoriaIdEdit) return;
    try {
      const atualizada = await api.put<Atividade>(`/atividades/${provaId}`, {
        titulo: tituloEdit,
        categoria_id: categoriaIdEdit,
        data: dataEdit,
      });
      setProva(atualizada);
      setEditando(false);
      toast.success("Prova atualizada.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar edição");
    }
  }

  async function excluirProva() {
    if (!confirm("Excluir esta prova? Ela deixará de aparecer nas listas e nos cálculos de nota.")) return;
    setExcluindo(true);
    try {
      await api.delete(`/atividades/${provaId}`);
      router.push("/notas/provas");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao excluir");
      setExcluindo(false);
    }
  }

  async function salvar() {
    setSalvando(true);
    try {
      const itens = alunos.map((a) => ({
        aluno_id: a.id,
        nota: notas[a.id] ? Number(notas[a.id]) : null,
      }));
      const salvos = await api.post<LancamentoRead[]>(`/atividades/${provaId}/lancamentos/lote`, { itens });
      const notasAtualizadas: Record<number, string> = {};
      for (const l of salvos) {
        if (l.nota !== null) notasAtualizadas[l.aluno_id] = String(l.nota);
      }
      setNotas(notasAtualizadas);
      toast.success("Notas salvas com sucesso.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  if (erroCarregar && !prova) return <p className="p-6 text-destructive">{erroCarregar}</p>;
  if (!prova) return <p className="p-6 text-muted-foreground">Carregando...</p>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <Link href="/notas/provas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Voltar para Provas
      </Link>

      {!editando ? (
        <PageHeader
          title={prova.titulo}
          subtitle={`Turma ${prova.turma} · ${prova.categoria_nome} · peso ${prova.categoria_peso} · ${alunos.length} aluno(s)`}
          action={
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={abrirEdicao}>
                Editar
              </Button>
              <Button variant="destructive" size="sm" onClick={excluirProva} disabled={excluindo}>
                Excluir
              </Button>
            </div>
          }
        />
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between border-b pb-3">
            <CardTitle>Editar prova</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={salvarEdicao} className="grid sm:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <Label>Título</Label>
                <Input required value={tituloEdit} onChange={(e) => setTituloEdit(e.target.value)} />
              </div>
              <CategoriaAtividadeField
                disciplinaId={prova.disciplina_id}
                categorias={categorias}
                categoriaId={categoriaIdEdit}
                onSelecionar={setCategoriaIdEdit}
                onCategoriaCriada={recarregarCategorias}
                somenteSelecionar
              />
              <div className="space-y-1">
                <Label>Data</Label>
                <Input type="date" value={dataEdit} onChange={(e) => setDataEdit(e.target.value)} />
              </div>
              <Button type="submit" variant="success" disabled={!categoriaIdEdit} className="sm:col-span-4 w-fit">
                Salvar alterações
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <ul className="divide-y">
          {alunos.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-(--card-spacing) py-3">
              <span className="text-sm text-foreground flex-1">
                {a.nome} <span className="text-muted-foreground">({a.matricula})</span>
              </span>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="10"
                placeholder="0"
                value={notas[a.id] ?? ""}
                onChange={(e) => setNotas((prev) => ({ ...prev, [a.id]: e.target.value }))}
                className="w-16 h-8 text-xs text-center"
              />
            </li>
          ))}
        </ul>
      </Card>

      <Button onClick={salvar} disabled={salvando} variant="success" size="lg">
        {salvando ? "Salvando..." : "Salvar notas"}
      </Button>
    </div>
  );
}

export default function ProvaDetalhePage() {
  return (
    <RequireAuth>
      <ProvaDetalheContent />
    </RequireAuth>
  );
}
