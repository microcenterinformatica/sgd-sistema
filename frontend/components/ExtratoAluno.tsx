"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { ExtratoAluno as Extrato, formatarNumeroCartao } from "@/lib/feirinha";

function formatarDataHora(iso: string): string {
  // Backend grava em UTC sem fuso.
  return new Date(iso + "Z").toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Quadro({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`rounded-xl border px-2 py-3 text-center ${destaque ? "bg-[#13294B] text-white border-[#13294B]" : "bg-white"}`}>
      <p className={`text-xs uppercase tracking-wide ${destaque ? "text-[#C0C6CE]" : "text-slate-500"}`}>{rotulo}</p>
      <p className={`text-3xl font-extrabold ${destaque ? "text-[#E8C766]" : "text-slate-800"}`}>{valor}</p>
    </div>
  );
}

/** Extrato do aluno: acumulado (Patrimônio Disciplinar), já gastou, disponível e cada compra. */
export function ExtratoAluno({ alunoId }: { alunoId: number }) {
  const [dados, setDados] = useState<Extrato | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Extrato>(`/feirinha/extrato/${alunoId}`)
      .then((d) => {
        setDados(d);
        setErro(null);
      })
      .catch((e) => setErro(e instanceof ApiError ? e.message : "Sem conexão com o servidor."));
  }, [alunoId]);

  if (erro) return <p className="text-sm text-red-700">{erro}</p>;
  if (!dados || dados.aluno_id !== alunoId) return <p className="text-sm text-slate-500">Carregando extrato...</p>;

  return (
    <div className="space-y-3">
      <div>
        <p className="font-bold text-lg text-slate-800 leading-tight">{dados.nome}</p>
        <p className="text-sm text-slate-500">
          {dados.turma ? `Turma ${dados.turma}` : "Sem turma"}
          {dados.numero_cartao !== null ? ` · Cartão Nº ${formatarNumeroCartao(dados.numero_cartao)}` : " · Sem cartão"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Quadro rotulo="Acumulado" valor={dados.acumulado} />
        <Quadro rotulo="Já gastou" valor={dados.gasto} />
        <Quadro rotulo="Disponível" valor={dados.saldo} destaque />
      </div>
      {dados.gasto > dados.acumulado && (
        <p className="text-xs text-amber-700">
          O acumulado diminuiu depois das compras (nova ocorrência), por isso não há saldo disponível.
        </p>
      )}

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Compras na feirinha</h3>
        {dados.compras.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma compra ainda.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-white">
            {dados.compras.map((c) => (
              <li key={c.transacao_id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className={`text-sm truncate ${c.estornado ? "line-through text-slate-400" : "text-slate-800"}`}>
                    {c.descricao || "Compra"}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {formatarDataHora(c.criado_em)}
                    {c.operador_nome ? ` · ${c.operador_nome}` : ""}
                    {c.estornado ? " · desfeita" : ""}
                  </p>
                </div>
                <span className={`text-sm font-semibold shrink-0 ${c.estornado ? "text-slate-400 line-through" : "text-red-700"}`}>
                  −{c.valor}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
