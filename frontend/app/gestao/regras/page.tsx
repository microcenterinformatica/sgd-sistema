"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { RegraInfracao } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function RegrasContent() {
  const [regras, setRegras] = useState<RegraInfracao[] | null>(null);
  const [descricao, setDescricao] = useState("");
  const [peso, setPeso] = useState("");
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editDescricao, setEditDescricao] = useState("");
  const [editPeso, setEditPeso] = useState("");

  async function carregar() {
    setRegras(await api.get<RegraInfracao[]>("/regras"));
  }

  useEffect(() => {
    carregar();
  }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/regras", { descricao, peso: Number(peso) });
      setDescricao("");
      setPeso("");
      carregar();
      toast.success("Regra cadastrada com sucesso");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar regra");
    }
  }

  async function excluir(id: number) {
    await api.delete(`/regras/${id}`);
    carregar();
    toast.success("Regra excluída");
  }

  async function alternarAtivo(regra: RegraInfracao) {
    await api.put(`/regras/${regra.id}`, { ativo: !regra.ativo });
    carregar();
  }

  function iniciarEdicao(regra: RegraInfracao) {
    setEditandoId(regra.id);
    setEditDescricao(regra.descricao);
    setEditPeso(String(regra.peso));
  }

  function cancelarEdicao() {
    setEditandoId(null);
  }

  async function salvarEdicao(id: number) {
    try {
      await api.put(`/regras/${id}`, { descricao: editDescricao, peso: Number(editPeso) });
      setEditandoId(null);
      carregar();
      toast.success("Regra atualizada com sucesso");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar regra");
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <PageHeader title="Regras de Infração" />

      <Card>
        <CardContent>
          <form onSubmit={criar} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label>Descrição</Label>
              <Input required value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Peso (pontos)</Label>
              <Input required type="number" min={1} value={peso} onChange={(e) => setPeso(e.target.value)} className="w-24" />
            </div>
            <Button type="submit">Adicionar</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardContent className="divide-y px-0">
          {regras?.map((r) =>
            editandoId === r.id ? (
              <div key={r.id} className="flex flex-wrap items-end gap-3 p-4">
                <div className="flex-1 min-w-[200px] space-y-1">
                  <Label>Descrição</Label>
                  <Input value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Peso (pontos)</Label>
                  <Input type="number" min={0} value={editPeso} onChange={(e) => setEditPeso(e.target.value)} className="w-24" />
                </div>
                <Button onClick={() => salvarEdicao(r.id)}>Salvar</Button>
                <Button variant="outline" onClick={cancelarEdicao}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <div key={r.id} className="flex items-center justify-between p-4">
                <div>
                  <p className={`font-medium ${r.ativo ? "text-foreground" : "text-muted-foreground line-through"}`}>{r.descricao}</p>
                  <p className="text-sm text-muted-foreground">{r.peso} pontos</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => iniciarEdicao(r)}>
                    Editar
                  </Button>
                  <Button variant="outline" onClick={() => alternarAtivo(r)}>
                    {r.ativo ? "Desativar" : "Ativar"}
                  </Button>
                  <Button variant="destructive" onClick={() => excluir(r.id)}>
                    Excluir
                  </Button>
                </div>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegrasPage() {
  return (
    <RequireAuth papeisPermitidos={["admin_escola", "coordenacao"]}>
      <RegrasContent />
    </RequireAuth>
  );
}
