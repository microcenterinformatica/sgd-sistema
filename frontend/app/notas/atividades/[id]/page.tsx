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
import { Badge } from "@/components/ui/badge";

function AtividadeDetalheContent() {
  const params = useParams<{ id: string }>();
  const atividadeId = Number(params.id);
  const router = useRouter();

  const [atividade, setAtividade] = useState<Atividade | null>(null);
  const [alunos, setAlunos] = useState<AlunoResumo[]>([]);
  const [fez, setFez] = useState<Record<number, boolean>>({});
  const [entregueEm, setEntregueEm] = useState<Record<number, string>>({});
  const [notas, setNotas] = useState<Record<number, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);

  const [editando, setEditando] = useState(false);
  const [tituloEdit, setTituloEdit] = useState("");
  const [categoriaIdEdit, setCategoriaIdEdit] = useState<number | "">("");
  const [dataEdit, setDataEdit] = useState("");
  const [dataEntregaEdit, setDataEntregaEdit] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const { categorias, recarregarCategorias } = useCategoriasAtividade(atividade?.disciplina_id ?? "");

  useEffect(() => {
    async function carregar() {
      try {
        const [atividades, listaAlunos, lancamentos] = await Promise.all([
          api.get<Atividade[]>("/atividades"),
          api.get<AlunoResumo[]>(`/atividades/${atividadeId}/alunos-turma`),
          api.get<LancamentoRead[]>(`/atividades/${atividadeId}/lancamentos`),
        ]);
        const atual = atividades.find((a) => a.id === atividadeId) ?? null;
        setAtividade(atual);
        setAlunos(listaAlunos);

        const marcados: Record<number, boolean> = {};
        const datas: Record<number, string> = {};
        const notasCarregadas: Record<number, string> = {};
        for (const l of lancamentos) {
          marcados[l.aluno_id] = l.fez ?? false;
          if (l.entregue_em) datas[l.aluno_id] = l.entregue_em;
          if (l.nota !== null) notasCarregadas[l.aluno_id] = String(l.nota);
        }
        setFez(marcados);
        setEntregueEm(datas);
        setNotas(notasCarregadas);
      } catch (err) {
        setErroCarregar(err instanceof ApiError ? err.message : "Erro ao carregar atividade");
      }
    }
    carregar();
  }, [atividadeId]);

  function abrirEdicao() {
    if (!atividade) return;
    setTituloEdit(atividade.titulo);
    setCategoriaIdEdit(atividade.categoria_id);
    setDataEdit(atividade.data);
    setDataEntregaEdit(atividade.data_entrega ?? "");
    setEditando(true);
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!categoriaIdEdit) return;
    try {
      const atualizada = await api.put<Atividade>(`/atividades/${atividadeId}`, {
        titulo: tituloEdit,
        categoria_id: categoriaIdEdit,
        data: dataEdit,
        data_entrega: dataEntregaEdit || null,
      });
      setAtividade(atualizada);
      setEditando(false);
      toast.success("Atividade atualizada.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar edição");
    }
  }

  async function excluirAtividade() {
    if (!confirm("Excluir esta atividade? Ela deixará de aparecer nas listas e nos cálculos de nota.")) return;
    setExcluindo(true);
    try {
      await api.delete(`/atividades/${atividadeId}`);
      router.push("/notas/atividades");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao excluir");
      setExcluindo(false);
    }
  }

  function marcarTodos(valor: boolean) {
    const novo: Record<number, boolean> = {};
    for (const a of alunos) novo[a.id] = valor;
    setFez(novo);
  }

  function noPrazo(alunoId: number): boolean | null {
    if (!atividade?.data_entrega || !entregueEm[alunoId]) return null;
    return entregueEm[alunoId] <= atividade.data_entrega;
  }

  async function salvar() {
    setSalvando(true);
    try {
      const itens = alunos.map((a) => ({
        aluno_id: a.id,
        fez: fez[a.id] ?? false,
        entregue_em: entregueEm[a.id] || null,
        nota: notas[a.id] ? Number(notas[a.id]) : null,
      }));
      const salvos = await api.post<LancamentoRead[]>(`/atividades/${atividadeId}/lancamentos/lote`, { itens });
      const notasAtualizadas: Record<number, string> = {};
      for (const l of salvos) {
        if (l.nota !== null) notasAtualizadas[l.aluno_id] = String(l.nota);
      }
      setNotas(notasAtualizadas);
      toast.success("Lançamento salvo com sucesso.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  if (erroCarregar && !atividade) return <p className="p-6 text-destructive">{erroCarregar}</p>;
  if (!atividade) return <p className="p-6 text-muted-foreground">Carregando...</p>;

  const totalFeitas = alunos.filter((a) => fez[a.id]).length;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <Link href="/notas/atividades" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Voltar para Atividades
      </Link>

      {!editando ? (
        <PageHeader
          title={atividade.titulo}
          subtitle={`Turma ${atividade.turma} · ${atividade.categoria_nome} · peso ${atividade.categoria_peso} · ${alunos.length} aluno(s)${
            atividade.data_entrega ? ` · entrega até ${atividade.data_entrega.split("-").reverse().join("/")}` : ""
          }`}
          action={
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={abrirEdicao}>
                Editar
              </Button>
              <Button variant="destructive" size="sm" onClick={excluirAtividade} disabled={excluindo}>
                Excluir
              </Button>
            </div>
          }
        />
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between border-b pb-3">
            <CardTitle>Editar atividade</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={salvarEdicao} className="grid sm:grid-cols-6 gap-3 items-end">
              <div className="sm:col-span-2 space-y-1">
                <Label>Título</Label>
                <Input required value={tituloEdit} onChange={(e) => setTituloEdit(e.target.value)} />
              </div>
              <CategoriaAtividadeField
                disciplinaId={atividade.disciplina_id}
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
              <div className="space-y-1">
                <Label>Data de entrega</Label>
                <Input type="date" value={dataEntregaEdit} onChange={(e) => setDataEntregaEdit(e.target.value)} />
              </div>
              <Button type="submit" variant="success" disabled={!categoriaIdEdit} className="sm:col-span-6 w-fit">
                Salvar alterações
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {`${totalFeitas} de ${alunos.length} marcados como "fez"`}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => marcarTodos(true)}>
            Marcar todos
          </Button>
          <Button variant="ghost" size="sm" onClick={() => marcarTodos(false)}>
            Desmarcar todos
          </Button>
        </div>
      </div>

      <Card>
        <ul className="divide-y">
          {alunos.map((a) => {
            const prazo = noPrazo(a.id);
            return (
              <li key={a.id} className="flex items-center justify-between gap-3 px-(--card-spacing) py-3">
                <span className="text-sm text-foreground flex-1">
                  {a.nome} <span className="text-muted-foreground">({a.matricula})</span>
                </span>

                {atividade.data_entrega && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={entregueEm[a.id] ?? ""}
                      onChange={(e) => setEntregueEm((prev) => ({ ...prev, [a.id]: e.target.value }))}
                      className="h-8 w-36 text-xs"
                    />
                    {prazo !== null && (
                      <Badge className={prazo ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
                        {prazo ? "no prazo" : "atrasado"}
                      </Badge>
                    )}
                  </div>
                )}

                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="10"
                  placeholder="10"
                  value={notas[a.id] ?? ""}
                  onChange={(e) => setNotas((prev) => ({ ...prev, [a.id]: e.target.value }))}
                  disabled={!fez[a.id]}
                  title="Nota (padrão 10 quando marcado como feito; ajuste para trabalhos mal feitos)"
                  className="w-16 h-8 text-xs text-center"
                />

                <input
                  type="checkbox"
                  checked={fez[a.id] ?? false}
                  onChange={(e) => setFez((prev) => ({ ...prev, [a.id]: e.target.checked }))}
                  className="size-4 accent-primary"
                />
              </li>
            );
          })}
        </ul>
      </Card>
      <p className="text-xs text-muted-foreground">
        Nota em branco = 10 automático para quem foi marcado como &quot;fez&quot;. Preencha manualmente para dar uma nota
        menor.
      </p>

      <Button onClick={salvar} disabled={salvando} variant="success" size="lg">
        {salvando ? "Salvando..." : "Salvar lançamento"}
      </Button>
    </div>
  );
}

export default function AtividadeDetalhePage() {
  return (
    <RequireAuth>
      <AtividadeDetalheContent />
    </RequireAuth>
  );
}
