"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calcularStatus } from "@/lib/conduta";
import { Aluno, BoletimAluno, Punicao } from "@/lib/types";

export function BoletimTurmaCard({
  boletim,
  alunosCompletosPorId,
  punicoes = [],
}: {
  boletim: BoletimAluno[];
  alunosCompletosPorId?: Map<number, Aluno>;
  punicoes?: Punicao[];
}) {
  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>Boletim da turma — nota final do período</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {boletim.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum aluno encontrado nessa turma.</p>
        ) : (
          boletim.map((b) => {
            const alunoCompleto = alunosCompletosPorId?.get(b.aluno_id);
            return (
              <div key={b.aluno_id} className="py-3 flex items-center justify-between gap-4 first:pt-0">
                <div className="w-40 shrink-0 space-y-1">
                  <span className="text-sm text-foreground truncate block">{b.aluno_nome}</span>
                  {alunoCompleto && (
                    <Badge variant="secondary" className="text-[10px]">
                      {calcularStatus(alunoCompleto.pontos_atuais, punicoes)}
                    </Badge>
                  )}
                </div>
                <div className="flex-1 flex flex-wrap gap-2">
                  {b.grupos.map((g) => (
                    <span key={g.categoria} className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                      {g.categoria} (peso {g.peso}): {g.pontos} pts
                    </span>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground w-20 text-right">{b.total_faltas} falta(s)</span>
                {b.peso_total > 0 && (
                  <Badge className={b.nota_final >= 6 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
                    {b.nota_final >= 6 ? "Aprovado" : "Reprovado"}
                  </Badge>
                )}
                <span className="text-sm font-bold text-foreground w-24 text-right">
                  {b.nota_final} / {b.peso_total}
                </span>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
