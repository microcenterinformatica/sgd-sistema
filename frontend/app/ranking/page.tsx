"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Award, MinusCircle } from "lucide-react";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { Professor, RankingItem, RegistroMeritoTurmaResponse } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MEDALHAS = ["🥇", "🥈", "🥉"];
const SEM_TURMA = "Sem turma";

const meritoTurmaSchema = z.object({
  pontos_bonus: z
    .number({ message: "Informe a quantidade de Veracom" })
    .positive("Informe um valor positivo de Veracom"),
  professor_id: z.string().optional(),
  observacao: z.string().optional(),
});
type MeritoTurmaForm = z.infer<typeof meritoTurmaSchema>;

function ProfessorSelect({ professores, value, onChange }: { professores: Professor[]; value?: string; onChange: (v: string) => void }) {
  return (
    <Select value={value || undefined} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Professor (opcional)" />
      </SelectTrigger>
      <SelectContent>
        {professores.map((p) => (
          <SelectItem key={p.id} value={String(p.id)}>
            {p.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const MERITO_TURMA_TEXTOS = {
  dar: {
    endpoint: "/registros/merito-turma",
    titulo: (turma: string) => `Mérito para a turma ${turma}`,
    descricao: "Os Veracom serão lançados individualmente para todos os alunos matriculados nesta turma.",
    placeholderPontos: "Veracom de bônus",
    placeholderMotivo: "Motivo do mérito",
    botao: "Registrar mérito para a turma",
    botaoCarregando: "Registrando...",
    toastSucesso: (total: number, turma: string) => `Mérito lançado para ${total} aluno(s) da turma ${turma}`,
    toastErro: "Erro ao registrar mérito para a turma",
    variant: "merito" as const,
  },
  remover: {
    endpoint: "/registros/remover-merito-turma",
    titulo: (turma: string) => `Remover mérito da turma ${turma}`,
    descricao: "Os Veracom serão descontados do mérito de todos os alunos matriculados nesta turma, sem afetar a pontuação disciplinar individual.",
    placeholderPontos: "Veracom a remover",
    placeholderMotivo: "Motivo da remoção",
    botao: "Remover mérito da turma",
    botaoCarregando: "Removendo...",
    toastSucesso: (total: number, turma: string) => `Mérito removido de ${total} aluno(s) da turma ${turma}`,
    toastErro: "Erro ao remover mérito da turma",
    variant: "destructive" as const,
  },
};

function MeritoTurmaDialog({
  modo,
  turma,
  open,
  onOpenChange,
  professores,
  onRegistrado,
}: {
  modo: "dar" | "remover";
  turma: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professores: Professor[];
  onRegistrado: () => void;
}) {
  const textos = MERITO_TURMA_TEXTOS[modo];
  const { control, register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<MeritoTurmaForm>({
    resolver: zodResolver(meritoTurmaSchema),
    defaultValues: { pontos_bonus: undefined, professor_id: "", observacao: "" },
  });

  async function onSubmit(dados: MeritoTurmaForm) {
    try {
      const resp = await api.post<RegistroMeritoTurmaResponse>(textos.endpoint, {
        turma,
        pontos_bonus: dados.pontos_bonus,
        professor_id: dados.professor_id ? Number(dados.professor_id) : null,
        observacao: dados.observacao || null,
      });
      reset();
      onOpenChange(false);
      onRegistrado();
      toast.success(textos.toastSucesso(resp.total_alunos, resp.turma));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : textos.toastErro);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{textos.titulo(turma)}</DialogTitle>
            <DialogDescription>{textos.descricao}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1">
            <Input
              type="number"
              min={1}
              placeholder={textos.placeholderPontos}
              aria-invalid={!!errors.pontos_bonus}
              {...register("pontos_bonus", { valueAsNumber: true })}
            />
            {errors.pontos_bonus && <p className="text-sm text-destructive">{errors.pontos_bonus.message}</p>}
          </div>

          <Controller
            control={control}
            name="professor_id"
            render={({ field }) => <ProfessorSelect professores={professores} value={field.value} onChange={field.onChange} />}
          />

          <Textarea placeholder={textos.placeholderMotivo} rows={3} {...register("observacao")} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant={textos.variant} disabled={isSubmitting}>
              {isSubmitting ? textos.botaoCarregando : textos.botao}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface GrupoRanking {
  turma: string;
  itens: ItemComPosicao[];
}

function detalhe(item: RankingItem): string {
  return `mérito ${item.total_merito} · ocorrências ${item.total_infracao} · ${item.faltas_nao_justificadas} falta(s) · ${item.atividades_nao_entregues} não entregue(s)`;
}

interface ItemComPosicao {
  item: RankingItem;
  posicao: number;
}

/** Ranking por posição compartilhada: pontuação igual = mesma posição, próxima pula (1º, 1º, 3º). */
function ordenarComPosicaoCompartilhada(lista: RankingItem[]): ItemComPosicao[] {
  const ordenada = [...lista].sort((a, b) => b.pontuacao - a.pontuacao);
  const resultado: ItemComPosicao[] = [];
  let posicaoAtual = 0;
  let pontuacaoAnterior: number | null = null;
  ordenada.forEach((item, idx) => {
    if (pontuacaoAnterior === null || item.pontuacao !== pontuacaoAnterior) {
      posicaoAtual = idx + 1;
      pontuacaoAnterior = item.pontuacao;
    }
    resultado.push({ item, posicao: posicaoAtual });
  });
  return resultado;
}

function LinhaRanking({ item, posicao }: { item: RankingItem; posicao: number }) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <span className="w-8 text-center text-lg">{MEDALHAS[posicao - 1] ?? `${posicao}º`}</span>
        <div>
          <div className="font-medium text-foreground">{item.aluno_nome}</div>
          <div className="text-xs text-muted-foreground">{detalhe(item)}</div>
        </div>
      </div>
      <span className="text-amber-600 font-bold">{item.pontuacao} Veracom</span>
    </div>
  );
}

function RankingContent() {
  const [itens, setItens] = useState<RankingItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [visao, setVisao] = useState<"turma" | "geral">("turma");
  const [turmaFiltro, setTurmaFiltro] = useState<string>("todas");
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [dialogoMeritoTurma, setDialogoMeritoTurma] = useState<"dar" | "remover" | null>(null);

  function carregarRanking() {
    api
      .get<RankingItem[]>("/ranking")
      .then(setItens)
      .catch((err) => setErro(err instanceof ApiError ? err.message : "Erro ao carregar ranking"));
  }

  useEffect(() => {
    carregarRanking();
    api.get<Professor[]>("/professores").then(setProfessores).catch(() => {});
  }, []);

  const turmaSelecionada = visao === "turma" && turmaFiltro !== "todas" && turmaFiltro !== "sem-turma" ? turmaFiltro : null;

  const turmasDisponiveis = useMemo(() => {
    if (!itens) return [];
    const unicas = new Set(itens.map((i) => i.turma).filter((t): t is string => !!t));
    return Array.from(unicas).sort();
  }, [itens]);

  const geral = useMemo(() => {
    if (!itens) return null;
    return ordenarComPosicaoCompartilhada(itens);
  }, [itens]);

  const grupos = useMemo<GrupoRanking[] | null>(() => {
    if (!itens) return null;
    const porTurma = new Map<string, RankingItem[]>();
    for (const item of itens) {
      const turma = item.turma ?? SEM_TURMA;
      const lista = porTurma.get(turma) ?? [];
      lista.push(item);
      porTurma.set(turma, lista);
    }
    return Array.from(porTurma.entries())
      .map(([turma, lista]) => ({ turma, itens: ordenarComPosicaoCompartilhada(lista) }))
      .sort((a, b) => {
        if (a.turma === SEM_TURMA) return 1;
        if (b.turma === SEM_TURMA) return -1;
        return a.turma.localeCompare(b.turma);
      });
  }, [itens]);

  const gruposExibidos = useMemo(() => {
    if (!grupos) return null;
    if (turmaFiltro === "todas") return grupos;
    const turmaAlvo = turmaFiltro === "sem-turma" ? SEM_TURMA : turmaFiltro;
    return grupos.filter((g) => g.turma === turmaAlvo);
  }, [grupos, turmaFiltro]);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Patrimônio Disciplinar"
        subtitle="Veracom = mérito − ocorrências de indisciplina − (peso × faltas não justificadas) − (peso × atividades não entregues)."
        action={
          <div className="flex gap-2">
            <Button
              variant={visao === "turma" ? "default" : "outline"}
              size="sm"
              onClick={() => setVisao("turma")}
            >
              Por turma
            </Button>
            <Button
              variant={visao === "geral" ? "default" : "outline"}
              size="sm"
              onClick={() => setVisao("geral")}
            >
              Geral
            </Button>
            {turmaSelecionada && (
              <>
                <Button variant="merito" size="sm" onClick={() => setDialogoMeritoTurma("dar")}>
                  <Award />
                  Mérito para a turma
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDialogoMeritoTurma("remover")}>
                  <MinusCircle />
                  Remover mérito da turma
                </Button>
              </>
            )}
          </div>
        }
      />

      {turmaSelecionada && dialogoMeritoTurma && (
        <MeritoTurmaDialog
          modo={dialogoMeritoTurma}
          turma={turmaSelecionada}
          open={!!dialogoMeritoTurma}
          onOpenChange={(open) => setDialogoMeritoTurma(open ? dialogoMeritoTurma : null)}
          professores={professores}
          onRegistrado={carregarRanking}
        />
      )}

      {erro && <p className="text-destructive">{erro}</p>}
      {itens === null && !erro && <p className="text-muted-foreground">Carregando...</p>}
      {itens?.length === 0 && <p className="text-muted-foreground">Nenhum aluno cadastrado ainda.</p>}

      {visao === "geral" && geral && geral.length > 0 && (
        <Card className="py-0">
          <CardContent className="divide-y px-0">
            {geral.map(({ item, posicao }) => (
              <LinhaRanking key={item.aluno_id} item={item} posicao={posicao} />
            ))}
          </CardContent>
        </Card>
      )}

      {visao === "turma" && (
        <>
          {turmasDisponiveis.length > 0 && (
            <Select value={turmaFiltro} onValueChange={(v) => setTurmaFiltro(v ?? "todas")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as turmas</SelectItem>
                {turmasDisponiveis.map((t) => (
                  <SelectItem key={t} value={t}>
                    Turma {t}
                  </SelectItem>
                ))}
                <SelectItem value="sem-turma">Sem turma</SelectItem>
              </SelectContent>
            </Select>
          )}

          {gruposExibidos?.map((grupo) => (
            <div key={grupo.turma} className="space-y-2">
              <h2 className="font-bold text-foreground">
                {grupo.turma === SEM_TURMA ? SEM_TURMA : `Turma ${grupo.turma}`}
              </h2>
              <Card className="py-0">
                <CardContent className="divide-y px-0">
                  {grupo.itens.map(({ item, posicao }) => (
                    <LinhaRanking key={item.aluno_id} item={item} posicao={posicao} />
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function RankingPage() {
  return (
    <RequireAuth>
      <RankingContent />
    </RequireAuth>
  );
}
