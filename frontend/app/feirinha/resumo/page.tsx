"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import RequireAuth from "@/components/RequireAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { ResumoFeirinha } from "@/lib/feirinha";

function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Resumo() {
  const [data, setData] = useState(hojeLocal());
  const [resumo, setResumo] = useState<ResumoFeirinha | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    api
      .get<ResumoFeirinha>(`/feirinha/resumo?data=${data}`)
      .then((r) => {
        setResumo(r);
        setErro(null);
      })
      .catch((e) => setErro(e instanceof ApiError ? e.message : "Sem conexão com o servidor."));
  }, [data]);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <Link href="/feirinha/caixa" className="text-sm text-blue-700 flex items-center gap-1">
        <ArrowLeft className="size-4" /> Voltar ao caixa
      </Link>
      <PageHeader
        title="Resumo da Feirinha"
        subtitle="Total vendido no dia, por turma e por aluno. Vendas desfeitas não entram no total."
        action={<Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-[170px]" />}
      />
      {erro && <p className="text-destructive">{erro}</p>}
      {resumo && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-slate-500">Total vendido</p>
                <p className="text-2xl font-bold">{resumo.total_geral}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-slate-500">Compras</p>
                <p className="text-2xl font-bold">{resumo.compras}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-slate-500">Desfeitas</p>
                <p className="text-2xl font-bold">{resumo.estornadas}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Por turma</CardTitle>
            </CardHeader>
            <CardContent>
              {resumo.por_turma.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma venda nesta data.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-1">Turma</th>
                      <th className="py-1 text-right">Compras</th>
                      <th className="py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.por_turma.map((t) => (
                      <tr key={t.turma ?? "-"} className="border-t">
                        <td className="py-1.5">{t.turma ?? "Sem turma"}</td>
                        <td className="py-1.5 text-right">{t.compras}</td>
                        <td className="py-1.5 text-right font-semibold">{t.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {resumo.por_aluno.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por aluno</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-1">Aluno</th>
                      <th className="py-1">Turma</th>
                      <th className="py-1 text-right">Compras</th>
                      <th className="py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.por_aluno.map((a) => (
                      <tr key={a.aluno_id} className="border-t">
                        <td className="py-1.5">{a.aluno_nome}</td>
                        <td className="py-1.5">{a.turma ?? "-"}</td>
                        <td className="py-1.5 text-right">{a.compras}</td>
                        <td className="py-1.5 text-right font-semibold">{a.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default function ResumoFeirinhaPage() {
  return (
    <RequireAuth>
      <Resumo />
    </RequireAuth>
  );
}
