"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { ConfiguracaoPeriodo, ConfiguracaoRanking, ConfiguracaoRecuperacao } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TRIMESTRES = [1, 2, 3] as const;

function ConfiguracaoRankingCard() {
  const [pesoFalta, setPesoFalta] = useState("1");
  const [pesoNaoEntrega, setPesoNaoEntrega] = useState("0");
  const [valorVeracomBase, setValorVeracomBase] = useState("0.2");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api
      .get<ConfiguracaoRanking>("/configuracao-ranking")
      .then((c) => {
        setPesoFalta(String(c.peso_falta));
        setPesoNaoEntrega(String(c.peso_nao_entrega));
        setValorVeracomBase(String(c.valor_veracom_base));
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Erro ao carregar configuração"))
      .finally(() => setCarregando(false));
  }, []);

  async function salvar() {
    setSalvando(true);
    try {
      await api.put("/configuracao-ranking", {
        peso_falta: Number(pesoFalta),
        peso_nao_entrega: Number(pesoNaoEntrega),
        valor_veracom_base: Number(valorVeracomBase),
      });
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
        <div className="space-y-1 max-w-xs">
          <Label>Peso de cada atividade não entregue</Label>
          {carregando ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <Input
              type="number"
              min="0"
              step="0.5"
              value={pesoNaoEntrega}
              onChange={(e) => setPesoNaoEntrega(e.target.value)}
            />
          )}
          <p className="text-xs text-muted-foreground">
            Quantos pontos descontam na pontuação do ranking quando um professor marca que o
            aluno não fez uma atividade ou prova (independente da nota). Deixe 0 para não descontar.
          </p>
        </div>
        <div className="space-y-1 max-w-xs">
          <Label>Valor do Veracom na base (R$)</Label>
          {carregando ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <Input
              type="number"
              min="0"
              step="0.01"
              value={valorVeracomBase}
              onChange={(e) => setValorVeracomBase(e.target.value)}
            />
          )}
          <p className="text-xs text-muted-foreground">
            Quanto vale 1 Veracom (em reais) quando o total de Veracom da turma está exatamente na
            base (número de alunos × 100). Se o total da turma cair abaixo da base a cotação cai; se
            subir acima, a cotação sobe.
          </p>
        </div>
        <Button onClick={salvar} disabled={salvando || carregando} variant="success">
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ConfiguracaoRecuperacaoCard() {
  const [ativo, setAtivo] = useState(false);
  const [diasParaRecuperacao, setDiasParaRecuperacao] = useState("7");
  const [pontosRecuperacao, setPontosRecuperacao] = useState("2");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api
      .get<ConfiguracaoRecuperacao>("/configuracao-recuperacao")
      .then((c) => {
        setAtivo(c.ativo);
        setDiasParaRecuperacao(String(c.dias_para_recuperacao));
        setPontosRecuperacao(String(c.pontos_recuperacao));
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Erro ao carregar configuração"))
      .finally(() => setCarregando(false));
  }, []);

  async function salvar() {
    setSalvando(true);
    try {
      await api.put("/configuracao-recuperacao", {
        ativo,
        dias_para_recuperacao: Number(diasParaRecuperacao),
        pontos_recuperacao: Number(pontosRecuperacao),
      });
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
        <CardTitle>Recuperação automática de pontos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Quando ativado, um aluno que ficar um período seguido sem nenhuma infração nova recebe um
          desconto automático na pontuação de indisciplina — um incentivo por bom comportamento
          contínuo. A contagem reinicia sempre que o aluno recebe uma infração nova.
        </p>

        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="size-4 accent-primary"
            disabled={carregando}
          />
          Ativar recuperação automática
        </label>

        <div className="grid sm:grid-cols-2 gap-4 max-w-md">
          <div className="space-y-1">
            <Label>Dias sem infração para recuperar</Label>
            {carregando ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <Input
                type="number"
                min="1"
                step="1"
                value={diasParaRecuperacao}
                onChange={(e) => setDiasParaRecuperacao(e.target.value)}
                disabled={!ativo}
              />
            )}
          </div>
          <div className="space-y-1">
            <Label>Pontos descontados automaticamente</Label>
            {carregando ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <Input
                type="number"
                min="1"
                step="1"
                value={pontosRecuperacao}
                onChange={(e) => setPontosRecuperacao(e.target.value)}
                disabled={!ativo}
              />
            )}
          </div>
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
      <ConfiguracaoRecuperacaoCard />
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
