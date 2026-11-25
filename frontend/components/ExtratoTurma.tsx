"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Printer, RefreshCw } from "lucide-react";
import { ComprasLista, formatarDataHora } from "@/components/ExtratoAluno";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ExtratoTurma as Extrato, formatarNumeroCartao } from "@/lib/feirinha";
import { MinhasAtribuicoesRead, Turma } from "@/lib/types";

const CHAVE_TURMA = "sgd_consulta_ultima_turma";
const COLUNAS = "grid grid-cols-[minmax(0,1fr)_4.6rem_3.4rem_3.4rem] gap-1";

const NOTA_TOTAL =
  "O saldo de um aluno nunca fica abaixo de zero. Por isso, o total do saldo pode não ser igual a acumulado − gastou.";

function somar(dados: Extrato) {
  return dados.alunos.reduce(
    (t, a) => ({ acumulado: t.acumulado + a.acumulado, gasto: t.gasto + a.gasto, saldo: t.saldo + a.saldo }),
    { acumulado: 0, gasto: 0, saldo: 0 }
  );
}

const ESTILO_IMPRESSAO = `
#impressao-extrato { display: none; }
@page { size: A4; margin: 12mm; }
@media print {
  body > *:not(#impressao-extrato) { display: none !important; }
  html, body { background: #fff !important; height: auto !important; }
  #impressao-extrato { display: block; color: #111; font-size: 10pt; }
  #impressao-extrato table { width: 100%; border-collapse: collapse; }
  #impressao-extrato th { text-align: left; font-size: 9pt; border-bottom: 0.4mm solid #111; padding: 1mm 1mm; }
  #impressao-extrato td { padding: 1mm 1mm; vertical-align: top; }
  #impressao-extrato .num { text-align: right; white-space: nowrap; width: 22mm; }
  #impressao-extrato tbody { break-inside: avoid; }
  #impressao-extrato tr.aluno td { border-top: 0.2mm solid #999; font-weight: 600; }
  #impressao-extrato tr.compra td { padding: 0 1mm 0.5mm 5mm; font-size: 8.5pt; color: #444; }
  #impressao-extrato tr.compra td.num { padding-left: 1mm; }
  #impressao-extrato .desfeita { text-decoration: line-through; color: #888; }
  #impressao-extrato tr.total td { border-top: 0.5mm solid #111; font-weight: 700; padding-top: 1.5mm; }
}
`;

function Impressao({ dados }: { dados: Extrato }) {
  const total = somar(dados);
  return createPortal(
    <div id="impressao-extrato">
      <style>{ESTILO_IMPRESSAO}</style>
      <div style={{ fontWeight: 700, fontSize: "12pt" }}>{dados.escola_nome}</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3mm" }}>
        <span>Saldo e gastos da feirinha · Turma {dados.turma}</span>
        <span>
          Emitido em{" "}
          {new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Aluno</th>
            <th className="num">Acumulado</th>
            <th className="num">Gastou</th>
            <th className="num">Saldo</th>
          </tr>
        </thead>
        {dados.alunos.map((a) => (
          <tbody key={a.aluno_id}>
            <tr className="aluno">
              <td>{a.nome}</td>
              <td className="num">{a.acumulado}</td>
              <td className="num">{a.gasto}</td>
              <td className="num">{a.saldo}</td>
            </tr>
            {a.compras.map((c) => (
              <tr className="compra" key={c.transacao_id}>
                <td className={c.estornado ? "desfeita" : undefined}>
                  {formatarDataHora(c.criado_em)} · {c.descricao || "Compra"}
                  {c.operador_nome ? ` · ${c.operador_nome}` : ""}
                  {c.estornado ? " (desfeita)" : ""}
                </td>
                <td />
                <td className={`num ${c.estornado ? "desfeita" : ""}`}>{c.valor}</td>
                <td />
              </tr>
            ))}
          </tbody>
        ))}
        <tbody>
          <tr className="total">
            <td>TOTAL ({dados.alunos.length} alunos)</td>
            <td className="num">{total.acumulado}</td>
            <td className="num">{total.gasto}</td>
            <td className="num">{total.saldo}</td>
          </tr>
        </tbody>
      </table>
      {total.acumulado - total.gasto !== total.saldo && <p style={{ fontSize: "8.5pt", marginTop: "2mm" }}>{NOTA_TOTAL}</p>}
    </div>,
    document.body
  );
}

/** Acumulado, gasto e saldo de cada aluno da turma; tocar no aluno abre as compras dele. */
export function ExtratoTurma() {
  const { user } = useAuth();
  const [turmas, setTurmas] = useState<Turma[] | null>(null);
  const [turmaId, setTurmaId] = useState("");
  const [dados, setDados] = useState<Extrato | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [abertos, setAbertos] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function carregar() {
      let permitidas = await api.get<Turma[]>("/turmas-cadastro");
      if (user?.papel === "professor") {
        const minhas = await api.get<MinhasAtribuicoesRead>("/minhas-atribuicoes");
        const nomes = new Set(minhas.combinacoes.map((c) => c.turma));
        permitidas = permitidas.filter((t) => nomes.has(t.nome));
      }
      setTurmas(permitidas);
      const ultima = localStorage.getItem(CHAVE_TURMA);
      const inicial = permitidas.find((t) => String(t.id) === ultima) ?? permitidas[0];
      if (inicial) setTurmaId(String(inicial.id));
    }
    carregar().catch(() => setErro("Não foi possível carregar as turmas."));
  }, [user?.papel]);

  const buscar = useCallback(
    () =>
      api
        .get<Extrato>(`/feirinha/extrato-turma?turma_id=${turmaId}`)
        .then((d) => ({ dados: d, erro: null }))
        .catch((e) => ({ dados: null, erro: e instanceof ApiError ? e.message : "Sem conexão com o servidor." })),
    [turmaId]
  );

  useEffect(() => {
    if (!turmaId) return;
    localStorage.setItem(CHAVE_TURMA, turmaId);
    // Se trocar de turma antes de a resposta chegar, a resposta antiga é ignorada.
    let cancelado = false;
    buscar().then((r) => {
      if (cancelado) return;
      setDados(r.dados);
      setErro(r.erro);
    });
    return () => {
      cancelado = true;
    };
  }, [turmaId, buscar]);

  async function atualizar() {
    const r = await buscar();
    if (r.dados) setDados(r.dados);
    setErro(r.erro);
  }

  function alternar(id: number) {
    setAbertos((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(id)) novo.add(id);
      return novo;
    });
  }

  const total = dados && somar(dados);

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-center gap-2">
          <Select
            value={turmaId}
            onValueChange={(v) => {
              if (!v || v === turmaId) return;
              setDados(null);
              setErro(null);
              setAbertos(new Set());
              setTurmaId(v);
            }}
          >
            <SelectTrigger className="flex-1 data-[size=default]:h-12 text-base">
              <SelectValue placeholder="Turma">
                {(v: string) => {
                  const t = turmas?.find((x) => String(x.id) === v);
                  return t ? `Turma ${t.nome}` : "Escolha a turma";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(turmas ?? []).map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  Turma {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-12 w-12" onClick={atualizar} disabled={!turmaId} aria-label="Atualizar lista" title="Atualizar">
            <RefreshCw className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="h-12 px-3"
            onClick={() => window.print()}
            disabled={!dados || dados.alunos.length === 0}
          >
            <Printer className="size-4" /> Imprimir
          </Button>
        </div>

        {erro && <p className="text-sm text-red-700">{erro}</p>}
        {turmas?.length === 0 && <p className="text-sm text-slate-500">Nenhuma turma disponível para você.</p>}
        {turmaId && !dados && !erro && <p className="text-sm text-slate-500">Carregando lista...</p>}
        {dados?.alunos.length === 0 && <p className="text-sm text-slate-500">Nenhum aluno nesta turma.</p>}

        {dados && total && dados.alunos.length > 0 && (
          <>
            <div className="rounded-xl border bg-white text-sm">
              <div className={`${COLUNAS} px-3 py-2 text-xs text-slate-500 border-b`}>
                <span>Aluno</span>
                <span className="text-right">Acumulado</span>
                <span className="text-right">Gastou</span>
                <span className="text-right">Saldo</span>
              </div>
              <ul className="divide-y">
                {dados.alunos.map((a) => {
                  const aberto = abertos.has(a.aluno_id);
                  return (
                    <li key={a.aluno_id}>
                      <button
                        type="button"
                        onClick={() => alternar(a.aluno_id)}
                        aria-expanded={aberto}
                        className={`${COLUNAS} w-full items-center px-3 py-2 min-h-11 text-left active:bg-slate-50`}
                      >
                        {/* No celular o nome ocupa a linha toda e os valores ficam embaixo. */}
                        <span className="col-span-4 sm:col-span-1 flex items-start gap-1 min-w-0">
                          {aberto ? (
                            <ChevronDown className="size-4 mt-0.5 shrink-0 text-slate-400" />
                          ) : (
                            <ChevronRight className="size-4 mt-0.5 shrink-0 text-slate-400" />
                          )}
                          <span className="font-medium text-slate-800 leading-tight min-w-0 wrap-break-word">{a.nome}</span>
                        </span>
                        <span className={`col-start-2 text-right tabular-nums ${a.acumulado < 0 ? "text-red-700" : "text-slate-700"}`}>{a.acumulado}</span>
                        <span className="text-right tabular-nums text-slate-700">{a.gasto}</span>
                        <span className="text-right tabular-nums font-bold text-[#13294B]">{a.saldo}</span>
                      </button>
                      {aberto && (
                        <div className="px-3 pb-3 sm:pl-8">
                          <p className="text-xs text-slate-500 mb-1">
                            {a.numero_cartao !== null ? `Cartão Nº ${formatarNumeroCartao(a.numero_cartao)}` : "Sem cartão"}
                          </p>
                          <ComprasLista compras={a.compras} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className={`${COLUNAS} px-3 py-2 border-t-2 font-bold text-slate-800`}>
                <span>Total ({dados.alunos.length})</span>
                <span className="text-right tabular-nums">{total.acumulado}</span>
                <span className="text-right tabular-nums">{total.gasto}</span>
                <span className="text-right tabular-nums">{total.saldo}</span>
              </div>
            </div>
            {total.acumulado - total.gasto !== total.saldo && (
              <p className="text-xs text-slate-500">{NOTA_TOTAL}</p>
            )}
            <Impressao dados={dados} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
