"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { Aluno, Professor, RegistroDisciplinar, RegistroDisciplinarResponse, RegraInfracao } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const infracaoSchema = z.object({
  regra_id: z.string().min(1, "Selecione uma regra"),
  professor_id: z.string().optional(),
  observacao: z.string().optional(),
});
type InfracaoForm = z.infer<typeof infracaoSchema>;

const meritoSchema = z.object({
  pontos_bonus: z
    .number({ message: "Informe os pontos de bônus" })
    .positive("Informe um valor positivo de pontos"),
  professor_id: z.string().optional(),
  observacao: z.string().optional(),
});
type MeritoForm = z.infer<typeof meritoSchema>;

function ProfessorSelect({ professores, value, onChange }: { professores: Professor[]; value?: string; onChange: (v: string) => void }) {
  return (
    <Select value={value || undefined} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger className="w-full h-12 text-base">
        <SelectValue placeholder="Professor (opcional)" />
      </SelectTrigger>
      <SelectContent>
        {professores.map((p) => (
          <SelectItem key={p.id} value={String(p.id)} className="text-base py-2.5">
            {p.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RegistrarInfracao({
  alunoId,
  regras,
  professores,
  onRegistrado,
}: {
  alunoId: number;
  regras: RegraInfracao[];
  professores: Professor[];
  onRegistrado: (resp: RegistroDisciplinarResponse) => void;
}) {
  const { control, register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<InfracaoForm>({
    resolver: zodResolver(infracaoSchema),
    defaultValues: { regra_id: "", professor_id: "", observacao: "" },
  });

  async function onSubmit(dados: InfracaoForm) {
    try {
      const resp = await api.post<RegistroDisciplinarResponse>("/registros/infracao", {
        aluno_id: alunoId,
        regra_id: Number(dados.regra_id),
        professor_id: dados.professor_id ? Number(dados.professor_id) : null,
        observacao: dados.observacao || null,
      });
      reset();
      onRegistrado(resp);
      toast.success("Infração registrada com sucesso");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao registrar infração");
    }
  }

  return (
    <Card className="border-t-4 border-t-destructive">
      <CardHeader>
        <CardTitle className="text-xl">🚨 Registrar infração</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Controller
              control={control}
              name="regra_id"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={(v) => field.onChange(v ?? "")}>
                  <SelectTrigger className="w-full h-12 text-base" aria-invalid={!!errors.regra_id}>
                    <SelectValue placeholder="Selecione a regra..." />
                  </SelectTrigger>
                  <SelectContent>
                    {regras.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)} className="text-base py-2.5">
                        {r.descricao} ({r.peso} pts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.regra_id && <p className="text-sm text-destructive">{errors.regra_id.message}</p>}
          </div>

          <Controller
            control={control}
            name="professor_id"
            render={({ field }) => <ProfessorSelect professores={professores} value={field.value} onChange={field.onChange} />}
          />

          <Textarea placeholder="Observação" rows={3} className="text-base" {...register("observacao")} />

          <Button type="submit" variant="destructive" disabled={isSubmitting} className="w-full h-12 text-base">
            {isSubmitting ? "Registrando..." : "Registrar infração"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function RegistrarMerito({
  alunoId,
  professores,
  onRegistrado,
}: {
  alunoId: number;
  professores: Professor[];
  onRegistrado: (resp: RegistroDisciplinarResponse) => void;
}) {
  const { control, register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<MeritoForm>({
    resolver: zodResolver(meritoSchema),
    defaultValues: { pontos_bonus: undefined, professor_id: "", observacao: "" },
  });

  async function onSubmit(dados: MeritoForm) {
    try {
      const resp = await api.post<RegistroDisciplinarResponse>("/registros/merito", {
        aluno_id: alunoId,
        pontos_bonus: dados.pontos_bonus,
        professor_id: dados.professor_id ? Number(dados.professor_id) : null,
        observacao: dados.observacao || null,
      });
      reset();
      onRegistrado(resp);
      toast.success("Mérito registrado com sucesso");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao registrar mérito");
    }
  }

  return (
    <Card className="border-t-4 border-t-amber-500">
      <CardHeader>
        <CardTitle className="text-xl">🌟 Registrar mérito</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Input
              type="number"
              min={1}
              placeholder="Pontos de bônus"
              aria-invalid={!!errors.pontos_bonus}
              className="h-12 text-base"
              {...register("pontos_bonus", { valueAsNumber: true })}
            />
            {errors.pontos_bonus && <p className="text-sm text-destructive">{errors.pontos_bonus.message}</p>}
          </div>

          <Controller
            control={control}
            name="professor_id"
            render={({ field }) => <ProfessorSelect professores={professores} value={field.value} onChange={field.onChange} />}
          />

          <Textarea placeholder="Motivo do mérito" rows={3} className="text-base" {...register("observacao")} />

          <Button type="submit" variant="merito" disabled={isSubmitting} className="w-full h-12 text-base">
            {isSubmitting ? "Registrando..." : "Registrar mérito"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ObservacoesAluno({ observacoes }: { observacoes: string | null }) {
  return (
    <Card className="border-t-4 border-t-primary">
      <CardHeader>
        <CardTitle className="text-lg">📝 Observações sobre o aluno</CardTitle>
      </CardHeader>
      <CardContent>
        {observacoes ? (
          <p className="text-base text-foreground whitespace-pre-wrap">{observacoes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma observação registrada.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Historico({ registros }: { registros: RegistroDisciplinar[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>📖 Histórico</CardTitle>
      </CardHeader>
      <CardContent>
        {registros.length === 0 && <p className="text-muted-foreground text-sm">Nenhum registro ainda.</p>}
        <ul className="divide-y">
          {registros.map((r) => (
            <li key={r.id} className="py-2 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={r.tipo === "infracao" ? "destructive" : "secondary"}
                    className={r.tipo === "merito" ? "bg-amber-100 text-amber-700" : ""}
                  >
                    {r.tipo === "infracao" ? "Infração" : "Mérito"}
                  </Badge>
                  <p className="text-sm font-medium text-foreground">{r.descricao}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(r.data_hora).toLocaleString("pt-BR")}
                  {r.professor_nome ? ` — Professor(a): ${r.professor_nome}` : ""}
                  {r.observacao ? ` — ${r.observacao}` : ""}
                </p>
              </div>
              <span className={`text-sm font-semibold shrink-0 ${r.peso >= 0 ? "text-destructive" : "text-emerald-600"}`}>
                {r.peso >= 0 ? `+${r.peso}` : r.peso}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function AlunoDetailContent() {
  const params = useParams<{ id: string }>();
  const alunoId = Number(params.id);

  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [regras, setRegras] = useState<RegraInfracao[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [registros, setRegistros] = useState<RegistroDisciplinar[]>([]);
  const [ultimoWhatsapp, setUltimoWhatsapp] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregarRegistros = useCallback(async () => {
    const dados = await api.get<RegistroDisciplinar[]>(`/registros?aluno_id=${alunoId}`);
    setRegistros(dados);
  }, [alunoId]);

  useEffect(() => {
    async function carregarTudo() {
      try {
        const [a, r, p] = await Promise.all([
          api.get<Aluno>(`/alunos/${alunoId}`),
          api.get<RegraInfracao[]>("/regras"),
          api.get<Professor[]>("/professores"),
        ]);
        setAluno(a);
        setRegras(r.filter((regra) => regra.ativo));
        setProfessores(p);
        await carregarRegistros();
      } catch (err) {
        setErro(err instanceof ApiError ? err.message : "Erro ao carregar dados do aluno");
      }
    }
    carregarTudo();
  }, [alunoId, carregarRegistros]);

  function handleRegistroFeito(resp: RegistroDisciplinarResponse) {
    setAluno((prev) => (prev ? { ...prev, pontos_atuais: resp.pontos_atuais } : prev));
    setUltimoWhatsapp(resp.whatsapp_link);
    carregarRegistros();
  }

  if (erro) return <p className="p-6 text-destructive">{erro}</p>;
  if (!aluno) return <p className="p-6 text-muted-foreground">Carregando...</p>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{aluno.nome}</h1>
          <p className="text-muted-foreground text-sm">
            Matrícula: {aluno.matricula}
            {aluno.turma ? ` — Turma ${aluno.turma}` : ""}
          </p>
          <Link href="/gestao/alunos" className="text-xs text-primary hover:underline">
            Editar dados do aluno em Gestão de Cadastros →
          </Link>
        </div>
        <span className="text-lg font-bold px-4 py-2 rounded-full bg-primary text-primary-foreground shadow-sm">
          {aluno.pontos_atuais} pontos
        </span>
      </div>

      <Dialog open={!!ultimoWhatsapp} onOpenChange={(open) => !open && setUltimoWhatsapp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar notificação ao responsável?</DialogTitle>
            <DialogDescription>
              Registro salvo. Deseja realmente enviar a notificação via WhatsApp para o responsável agora?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUltimoWhatsapp(null)}>
              Não
            </Button>
            {ultimoWhatsapp && (
              <Button
                variant="success"
                render={<a href={ultimoWhatsapp} target="_blank" rel="noopener noreferrer" />}
                onClick={() => setUltimoWhatsapp(null)}
              >
                Sim, enviar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div id="registrar" className="grid md:grid-cols-2 gap-4 scroll-mt-4">
        <RegistrarInfracao alunoId={aluno.id} regras={regras} professores={professores} onRegistrado={handleRegistroFeito} />
        <RegistrarMerito alunoId={aluno.id} professores={professores} onRegistrado={handleRegistroFeito} />
      </div>

      <ObservacoesAluno observacoes={aluno.observacoes_condutas} />

      <Historico registros={registros} />
    </div>
  );
}

export default function AlunoDetailPage() {
  return (
    <RequireAuth>
      <AlunoDetailContent />
    </RequireAuth>
  );
}
