"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { ConfiguracaoPeriodo, ConfiguracaoRanking } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TRIMESTRES = [1, 2, 3] as const;

function ConfiguracaoRankingCard() {
  const [pesoFalta, setPesoFalta] = useState("1");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api
      .get<ConfiguracaoRanking>("/configuracao-ranking")
      .then((c) => setPesoFalta(String(c.peso_falta)))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Erro ao carregar configuração"))
      .finally(() => setCarregando(false));
  }, []);

  async function salvar() {
    setSalvando(true);
    try {
      await api.put("/configuracao-ranking", { peso_falta: Number(pesoFalta) });
      toast.success("Configuração salva com sucesso.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>Ranking de Mérito</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 max-w-xs">
          <Label>Peso de cada falta não justificada</Label>
          {carregando ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <Input
              type="number"
              min="0"
              step="0.5"
              value={pesoFalta}
              onChange={(e) => setPesoFalta(e.target.value)}
            />
          )}
          <p className="text-xs text-muted-foreground">
            Quantos pontos cada falta não justificada desconta na pontuação do ranking.
          </p>
        </div>
        <Button onClick={salvar} disabled={salvando || carregando} variant="success">
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ConfiguracoesContent() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api
      .get<ConfiguracaoPeriodo>("/configuracao-periodo")
      .then((c) => {
        const valores: Record<string, string> = {};
        for (const [chave, valor] of Object.entries(c)) {
          valores[chave] = valor ?? "";
        }
        setConfig(valores);
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Erro ao carregar configuração"))
      .finally(() => setCarregando(false));
  }, []);

  function set(chave: string, valor: string) {
    setConfig((prev) => ({ ...prev, [chave]: valor }));
  }

  async function salvar() {
    setSalvando(true);
    try {
      const payload: Record<string, string | null> = {};
      for (const [chave, valor] of Object.entries(config)) {
        payload[chave] = valor || null;
      }
      await api.put("/configuracao-periodo", payload);
      toast.success("Configuração salva com sucesso.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <p className="p-6 text-muted-foreground">Carregando...</p>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <PageHeader
        title="Configuração dos trimestres"
        subtitle="Defina as datas de início e fim de cada trimestre do ano letivo. Essas datas são usadas para calcular o boletim anual dos alunos."
      />

      <Card>
        <CardContent className="space-y-4">
          {TRIMESTRES.map((t) => (
            <div key={t} className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t}º trimestre — início</Label>
                <Input
                  type="date"
                  value={config[`trimestre${t}_inicio`] ?? ""}
                  onChange={(e) => set(`trimestre${t}_inicio`, e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>{t}º trimestre — fim</Label>
                <Input
                  type="date"
                  value={config[`trimestre${t}_fim`] ?? ""}
                  onChange={(e) => set(`trimestre${t}_fim`, e.target.value)}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={salvar} disabled={salvando} variant="success" size="lg">
        {salvando ? "Salvando..." : "Salvar configuração"}
      </Button>

      <ConfiguracaoRankingCard />
    </div>
  );
}

export default function ConfiguracoesPage() {
  return (
    <RequireAuth papeisPermitidos={["admin_escola", "coordenacao"]}>
      <ConfiguracoesContent />
    </RequireAuth>
  );
}
