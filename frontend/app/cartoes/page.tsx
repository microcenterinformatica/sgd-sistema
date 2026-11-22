"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CreditCard, Printer, RefreshCw, ShoppingBasket } from "lucide-react";
import { toast } from "sonner";
import RequireAuth from "@/components/RequireAuth";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CartaoStatusAluno, GerarCartoesResultado, formatarNumeroCartao } from "@/lib/feirinha";
import { MinhasAtribuicoesRead, Turma } from "@/lib/types";

const CHAVE_TURMA = "sgd_cartoes_ultima_turma";

function Cartoes() {
  const { user } = useAuth();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaId, setTurmaId] = useState<string>("");
  const [alunos, setAlunos] = useState<CartaoStatusAluno[] | null>(null);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    async function carregar() {
      const todas = await api.get<Turma[]>("/turmas-cadastro");
      let permitidas = todas;
      if (user?.papel === "professor") {
        const minhas = await api.get<MinhasAtribuicoesRead>("/minhas-atribuicoes");
        const nomes = new Set(minhas.combinacoes.map((c) => c.turma));
        permitidas = todas.filter((t) => nomes.has(t.nome));
      }
      setTurmas(permitidas);
      const ultima = localStorage.getItem(CHAVE_TURMA);
      const inicial = permitidas.find((t) => String(t.id) === ultima) ?? permitidas[0];
      if (inicial) setTurmaId(String(inicial.id));
    }
    carregar().catch(() => toast.error("Não foi possível carregar as turmas."));
  }, [user?.papel]);

  const carregarAlunos = useCallback(async () => {
    if (!turmaId) return;
    try {
      setAlunos(await api.get<CartaoStatusAluno[]>(`/cartoes?turma_id=${turmaId}`));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar cartões.");
      setAlunos([]);
    }
  }, [turmaId]);

  useEffect(() => {
    if (!turmaId) return;
    localStorage.setItem(CHAVE_TURMA, turmaId);
    api
      .get<CartaoStatusAluno[]>(`/cartoes?turma_id=${turmaId}`)
      .then(setAlunos)
      .catch((e) => {
        toast.error(e instanceof ApiError ? e.message : "Erro ao carregar cartões.");
        setAlunos([]);
      });
  }, [turmaId]);

  const semCartao = useMemo(() => (alunos ?? []).filter((a) => a.cartao_id === null).length, [alunos]);
  const comCartao = (alunos?.length ?? 0) - semCartao;

  async function gerar() {
    setGerando(true);
    try {
      const r = await api.post<GerarCartoesResultado>(`/cartoes/gerar?turma_id=${turmaId}`);
      toast.success(r.gerados ? `${r.gerados} cartão(ões) gerado(s).` : "Todos os alunos já tinham cartão.");
      carregarAlunos();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao gerar cartões.");
    } finally {
      setGerando(false);
    }
  }

  async function reemitir(aluno: CartaoStatusAluno) {
    try {
      const r = await api.post<CartaoStatusAluno>(`/cartoes/${aluno.aluno_id}/reemitir`);
      toast.success(`Novo cartão Nº ${formatarNumeroCartao(r.numero!)} para ${aluno.aluno_nome}. O cartão antigo não funciona mais.`);
      carregarAlunos();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao reemitir cartão.");
    }
  }

  const turmaAtual = turmas.find((t) => String(t.id) === turmaId);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <PageHeader
        icon={<CreditCard className="inline size-6 -mt-1" />}
        title="Cartões da Feirinha"
        subtitle="Gere, reemita e imprima os cartões com QR code dos alunos."
        action={
          <Link href="/feirinha/caixa">
            <Button variant="outline">
              <ShoppingBasket className="size-4 mr-1" /> Abrir caixa
            </Button>
          </Link>
        }
      />

      <Card>
        <CardContent className="pt-4 flex flex-wrap items-center gap-3">
          <Select
            value={turmaId}
            onValueChange={(v) => {
              if (!v) return;
              setAlunos(null);
              setTurmaId(v);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Turma">
                {(v: string) => {
                  const t = turmas.find((x) => String(x.id) === v);
                  return t ? `Turma ${t.nome}` : "Escolha a turma";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {turmas.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  Turma {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={gerar} disabled={!turmaId || gerando || semCartao === 0}>
            <CreditCard className="size-4 mr-1" />
            {gerando ? "Gerando..." : `Gerar cartões${semCartao ? ` (${semCartao})` : ""}`}
          </Button>

          <Link
            href={turmaId ? `/cartoes/imprimir?turma_id=${turmaId}` : "#"}
            target="_blank"
            aria-disabled={!comCartao}
            className={!comCartao ? "pointer-events-none opacity-50" : ""}
          >
            <Button variant="outline" disabled={!comCartao}>
              <Printer className="size-4 mr-1" /> Imprimir cartões
            </Button>
          </Link>
        </CardContent>
      </Card>

      {turmas.length === 0 && <p className="text-slate-500">Nenhuma turma disponível para você.</p>}
      {turmaId && alunos === null && <p className="text-slate-500">Carregando...</p>}

      {alunos && alunos.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-slate-500 mb-2">
              Turma {turmaAtual?.nome}: {comCartao} com cartão, {semCartao} sem cartão.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 w-10">Nº</th>
                  <th className="py-1">Aluno</th>
                  <th className="py-1">Cartão</th>
                  <th className="py-1 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((a) => (
                  <tr key={a.aluno_id} className="border-t">
                    <td className="py-2 text-slate-500">{a.numero_chamada ?? "-"}</td>
                    <td className="py-2">{a.aluno_nome}</td>
                    <td className="py-2">
                      {a.numero !== null ? (
                        <span className="rounded bg-green-100 text-green-800 px-2 py-0.5 text-xs font-medium">
                          Nº {formatarNumeroCartao(a.numero)}
                        </span>
                      ) : (
                        <span className="rounded bg-slate-100 text-slate-600 px-2 py-0.5 text-xs">Sem cartão</span>
                      )}
                    </td>
                    <td className="py-2 text-right space-x-1 whitespace-nowrap">
                      {a.cartao_id !== null && (
                        <>
                          <Link href={`/cartoes/imprimir?turma_id=${turmaId}&aluno_id=${a.aluno_id}`} target="_blank">
                            <Button variant="ghost" size="sm" title="Imprimir só este cartão">
                              <Printer className="size-4" />
                            </Button>
                          </Link>
                          <ConfirmDialog
                            trigger={
                              <Button variant="outline" size="sm">
                                <RefreshCw className="size-4 mr-1" /> Reemitir
                              </Button>
                            }
                            title={`Reemitir cartão de ${a.aluno_nome}?`}
                            description="Use quando o cartão for perdido. O cartão atual deixa de funcionar na hora e um novo número é gerado. O saldo do aluno não muda."
                            confirmLabel="Reemitir"
                            onConfirm={() => reemitir(a)}
                          />
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      {alunos && alunos.length === 0 && turmaId && <p className="text-slate-500">Nenhum aluno nesta turma.</p>}
    </div>
  );
}

export default function CartoesPage() {
  return (
    <RequireAuth>
      <Cartoes />
    </RequireAuth>
  );
}
