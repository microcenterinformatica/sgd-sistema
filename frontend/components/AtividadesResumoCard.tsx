"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AtividadeResumoItem } from "@/lib/types";

function corBarra(percentual: number) {
  if (percentual >= 80) return "bg-emerald-500";
  if (percentual >= 50) return "bg-amber-500";
  return "bg-red-500";
}

export function AtividadesResumoCard({ resumo }: { resumo: AtividadeResumoItem[] }) {
  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>Resumo — % de atividades feitas por aluno</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {resumo.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma atividade cadastrada nesse período.</p>
        ) : (
          resumo.map((r) => (
            <div key={r.aluno_id} className="py-3 flex items-center gap-4 first:pt-0">
              <span className="text-sm text-foreground w-40 truncate">{r.aluno_nome}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${corBarra(r.percentual)}`} style={{ width: `${r.percentual}%` }} />
              </div>
              <span className="text-xs font-medium text-muted-foreground w-24 text-right">
                {r.total_fez}/{r.total_atividades} ({r.percentual}%)
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
