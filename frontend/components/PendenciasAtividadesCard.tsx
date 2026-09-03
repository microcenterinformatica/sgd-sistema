"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AtividadePendenciaRead } from "@/lib/types";

function formatarData(iso: string | null) {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function PendenciasAtividadesCard({ pendencias }: { pendencias: AtividadePendenciaRead[] }) {
  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>Pendências de entrega</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {pendencias.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma pendência — todo mundo entregou tudo nesse período.
          </p>
        ) : (
          pendencias.map((p) => (
            <div key={p.atividade_id} className="py-3 first:pt-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{p.atividade_titulo}</p>
                <Badge variant="secondary">
                  {p.alunos_pendentes.length} pendente{p.alunos_pendentes.length > 1 ? "s" : ""}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {p.data_entrega ? `entrega ${formatarData(p.data_entrega)}` : `lançada em ${formatarData(p.data)}`}
              </p>
              <ul className="text-sm text-foreground space-y-0.5">
                {p.alunos_pendentes.map((a) => (
                  <li key={a.aluno_id}>· {a.aluno_nome}</li>
                ))}
              </ul>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
