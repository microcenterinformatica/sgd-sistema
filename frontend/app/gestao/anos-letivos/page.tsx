"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { AnoLetivo } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ROTULO_SITUACAO: Record<string, string> = {
  aberto: "Aberto",
  encerrado: "Encerrado",
};

function SeletorSituacao({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="w-full">
        <SelectValue>{(v: string) => ROTULO_SITUACAO[v] ?? v}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="aberto">Aberto</SelectItem>
        <SelectItem value="encerrado">Encerrado</SelectItem>
      </SelectContent>
    </Select>
  );
}

function NovoAnoLetivoForm({ onCriado }: { onCriado: () => void }) {
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.post("/anos-letivos", {
        ano: Number(ano),
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
      });
      setDataInicio("");
      setDataFim("");
      onCriado();
      toast.success("Ano letivo criado. Ele passa a ser o ano vigente.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar ano letivo");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="grid sm:grid-cols-4 gap-2 items-end">
      <div className="space-y-1">
        <Label>Ano</Label>
        <Input required type="number" value={ano} onChange={(e) => setAno(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Início</Label>
        <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Fim</Label>
        <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
      </div>
      <Button type="submit" disabled={salvando}>
        <Plus />
        Adicionar
      </Button>
    </form>
  );
}

function ListaAnosLetivos({ anos, onAtualizado }: { anos: AnoLetivo[]; onAtualizado: () => void }) {
  async function alterarSituacao(id: number, situacao: string) {
    try {
      await api.put(`/anos-letivos/${id}`, { situacao });
      onAtualizado();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar situação");
    }
  }

  if (anos.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Nenhum ano letivo cadastrado ainda.</p>;
  }

  return (
    <Card>
      <ul className="divide-y">
        {anos.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2 px-(--card-spacing) py-2">
            <div>
              <span className="text-sm font-medium text-foreground">{a.ano}</span>
              {(a.data_inicio || a.data_fim) && (
                <span className="text-xs text-muted-foreground ml-2">
                  {a.data_inicio ?? "?"} até {a.data_fim ?? "?"}
                </span>
              )}
            </div>
            <div className="w-36">
              <SeletorSituacao value={a.situacao} onChange={(v) => alterarSituacao(a.id, v)} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AnosLetivosContent() {
  const [anos, setAnos] = useState<AnoLetivo[]>([]);

  async function carregar() {
    const lista = await api.get<AnoLetivo[]>("/anos-letivos");
    setAnos(lista);
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <PageHeader
        title="Anos Letivos"
        subtitle="Cadastre um novo ano letivo na virada do ano. A partir daí, ao mudar a turma de um aluno (tela de Alunos), o histórico de matrícula é gravado no ano vigente, sem apagar o ano anterior. Criar um ano novo marca automaticamente o anterior como encerrado."
      />

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle>Anos letivos cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <NovoAnoLetivoForm onCriado={carregar} />
          <ListaAnosLetivos anos={anos} onAtualizado={carregar} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function AnosLetivosPage() {
  return (
    <RequireAuth papeisPermitidos={["admin_escola", "coordenacao"]}>
      <AnosLetivosContent />
    </RequireAuth>
  );
}
