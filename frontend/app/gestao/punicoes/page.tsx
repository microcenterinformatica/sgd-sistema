"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { Punicao } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function PunicoesContent() {
  const [punicoes, setPunicoes] = useState<Punicao[] | null>(null);
  const [descricao, setDescricao] = useState("");
  const [pontuacaoMinima, setPontuacaoMinima] = useState("");

  async function carregar() {
    const dados = await api.get<Punicao[]>("/punicoes");
    setPunicoes(dados.sort((a, b) => a.pontuacao_minima - b.pontuacao_minima));
  }

  useEffect(() => {
    carregar();
  }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/punicoes", { descricao, pontuacao_minima: Number(pontuacaoMinima) });
      setDescricao("");
      setPontuacaoMinima("");
      carregar();
      toast.success("Conduta cadastrada com sucesso");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar conduta");
    }
  }

  async function excluir(id: number) {
    await api.delete(`/punicoes/${id}`);
    carregar();
    toast.success("Conduta excluída");
  }

  async function alternarAtivo(punicao: Punicao) {
    await api.put(`/punicoes/${punicao.id}`, { ativo: !punicao.ativo });
    carregar();
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <PageHeader title="Condutas" />

      <Card>
        <CardContent>
          <form onSubmit={criar} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label>Descrição</Label>
              <Input required value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Pontuação mínima</Label>
              <Input required type="number" min={0} value={pontuacaoMinima} onChange={(e) => setPontuacaoMinima(e.target.value)} className="w-28" />
            </div>
            <Button type="submit">Adicionar</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardContent className="divide-y px-0">
          {punicoes?.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-4">
              <div>
                <p className={`font-medium ${p.ativo ? "text-foreground" : "text-muted-foreground line-through"}`}>{p.descricao}</p>
                <p className="text-sm text-muted-foreground">A partir de {p.pontuacao_minima} pontos</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => alternarAtivo(p)}>
                  {p.ativo ? "Desativar" : "Ativar"}
                </Button>
                <Button variant="destructive" onClick={() => excluir(p.id)}>
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PunicoesPage() {
  return (
    <RequireAuth papeisPermitidos={["admin_escola", "coordenacao"]}>
      <PunicoesContent />
    </RequireAuth>
  );
}
