"use client";

import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { Download } from "lucide-react";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { calcularStatus } from "@/lib/conduta";
import {
  Aluno,
  AlunoResumo,
  BoletimAluno,
  BoletimAnualAluno,
  FaltaRead,
  LancamentoAlunoRead,
  Punicao,
  RegistroDisciplinar,
  TipoAtividade,
} from "@/lib/types";
import {
  escolherDisciplinaInicial,
  escolherTurmaInicial,
  salvarUltimaDisciplina,
  salvarUltimaTurma,
} from "@/lib/turmaPreferida";
import { useAtribuicoes } from "@/lib/useAtribuicoes";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const ROTULOS_TIPO: Record<TipoAtividade, string> = {
  atividade: "Atividade",
  prova: "Prova",
};

function formatarData(iso: string | null) {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function BadgePrazo({ noPrazo }: { noPrazo: boolean | null }) {
  if (noPrazo === null) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <Badge className={noPrazo ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
      {noPrazo ? "no prazo" : "atrasado"}
    </Badge>
  );
}

function AjusteNotaDialog({
  alunoId,
  disciplinaId,
  trimestre,
  ajusteAtual,
  onSalvo,
}: {
  alunoId: number;
  disciplinaId: number;
  trimestre: number;
  ajusteAtual: { id: number; nota_ajustada: number; motivo: string | null } | null;
  onSalvo: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [nota, setNota] = useState(ajusteAtual ? String(ajusteAtual.nota_ajustada) : "");
  const [motivo, setMotivo] = useState(ajusteAtual?.motivo ?? "");
  const [salvando, setSalvando] = useState(false);

  function abrir(v: boolean) {
    if (v) {
      setNota(ajusteAtual ? String(ajusteAtual.nota_ajustada) : "");
      setMotivo(ajusteAtual?.motivo ?? "");
    }
    setAberto(v);
  }

  async function salvar() {
    if (!nota || !motivo.trim()) return;
    setSalvando(true);
    try {
      await api.put("/boletim/ajuste", {
        aluno_id: alunoId,
        disciplina_id: disciplinaId,
        trimestre,
        nota_ajustada: Number(nota),
        motivo: motivo.trim(),
      });
      toast.success("Nota ajustada com sucesso");
      setAberto(false);
      onSalvo();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao ajustar nota");
    } finally {
      setSalvando(false);
    }
  }

  async function remover() {
    if (!ajusteAtual) return;
    if (!confirm("Remover o ajuste e voltar para a nota calculada automaticamente?")) return;
    setSalvando(true);
    try {
      await api.delete(`/boletim/ajuste/${ajusteAtual.id}`);
      toast.success("Ajuste removido");
      setAberto(false);
      onSalvo();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao remover ajuste");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={abrir}>
      <DialogTrigger render={<span />}>
        <Button variant="outline" size="sm">
          {ajusteAtual ? "Editar ajuste" : "Ajustar nota"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar nota — {trimestre}º trimestre</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label title="Substitui a nota calculada automaticamente pelas atividades, sem apagar o histórico de lançamentos.">
              Nota final ajustada
            </Label>
            <Input type="number" step="0.1" value={nota} onChange={(e) => setNota(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Motivo do ajuste</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Ex: aluno com laudo, decisão pedagógica do conselho de classe..."
            />
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          {ajusteAtual ? (
            <Button variant="destructive" onClick={remover} disabled={salvando}>
              Remover ajuste
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando || !nota || !motivo.trim()}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function gerarPdfBoletim(boletim: BoletimAnualAluno, turma: string) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Boletim Escolar", 14, 18);
  doc.setFontSize(11);
  doc.text(`Aluno: ${boletim.aluno_nome}`, 14, 28);
  doc.text(`Turma: ${turma}`, 14, 35);

  let y = 42;
  for (const disc of boletim.disciplinas) {
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(disc.disciplina_nome, 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Trimestre", "Período", "Nota final", "Máximo", "Faltas"]],
      body: disc.trimestres.map((t) => [
        `${t.trimestre}º trimestre`,
        `${formatarData(t.data_inicio)} a ${formatarData(t.data_fim)}`,
        String(t.nota_final),
        String(t.peso_total),
        String(t.total_faltas),
      ]),
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Média final: ${disc.media_final} · Faltas no ano: ${disc.total_faltas}`, 14, y);
    doc.setTextColor(disc.aprovado ? 5 : 190, disc.aprovado ? 120 : 40, disc.aprovado ? 70 : 40);
    doc.text(disc.aprovado ? "Aprovado" : "Reprovado", 170, y);
    y += 10;
  }

  doc.save(`boletim_${boletim.aluno_nome.replace(/\s+/g, "_")}.pdf`);
}

function ConsultarAlunoContent() {
  const { turmas, disciplinasDaTurma } = useAtribuicoes();
  const [turma, setTurma] = useState("");
  const [disciplinaId, setDisciplinaId] = useState<number | "">("");
  const [alunos, setAlunos] = useState<AlunoResumo[]>([]);
  const [alunoId, setAlunoId] = useState<number | "todos" | "">("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [lancamentos, setLancamentos] = useState<LancamentoAlunoRead[] | null>(null);
  const [boletim, setBoletim] = useState<BoletimAluno | null>(null);
  const [boletimTurma, setBoletimTurma] = useState<BoletimAluno[] | null>(null);
  const [boletimAnual, setBoletimAnual] = useState<BoletimAnualAluno | null>(null);
  const [carregandoBoletimAnual, setCarregandoBoletimAnual] = useState(false);
  const [faltasDetalhe, setFaltasDetalhe] = useState<FaltaRead[] | null>(null);
  const [registrosDisciplinares, setRegistrosDisciplinares] = useState<RegistroDisciplinar[] | null>(null);
  const [alunoDetalhe, setAlunoDetalhe] = useState<Aluno | null>(null);
  const [alunosTurmaCompletos, setAlunosTurmaCompletos] = useState<Aluno[]>([]);
  const [punicoes, setPunicoes] = useState<Punicao[]>([]);
  const [aba, setAba] = useState<"periodo" | "anual">("periodo");

  useEffect(() => {
    api.get<Punicao[]>("/punicoes").then(setPunicoes).catch(() => {});
  }, []);

  const alunosCompletosPorId = useMemo(
    () => new Map(alunosTurmaCompletos.map((a) => [a.id, a])),
    [alunosTurmaCompletos]
  );

  useEffect(() => {
    if (turmas.length === 0) return;
    setTurma((atual) => (atual && turmas.includes(atual) ? atual : escolherTurmaInicial(turmas)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmas]);

  const disciplinasDisponiveis = turma ? disciplinasDaTurma(turma) : [];

  useEffect(() => {
    if (disciplinasDisponiveis.length === 0) {
      setDisciplinaId("");
      return;
    }
    const ids = disciplinasDisponiveis.map((d) => d.disciplina_id);
    setDisciplinaId((atual) => (atual && ids.includes(atual) ? atual : escolherDisciplinaInicial(ids)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turma, disciplinasDisponiveis.length]);

  function selecionarTurma(t: string) {
    setTurma(t);
    salvarUltimaTurma(t);
  }

  function selecionarDisciplina(id: number) {
    setDisciplinaId(id);
    salvarUltimaDisciplina(id);
  }

  function selecionarAluno(valor: string) {
    if (valor === "todos") {
      setAlunoId("todos");
      return;
    }
    const id = valor ? Number(valor) : "";
    setAlunoId(id);
    if (id) localStorage.setItem("sgd_notas_ultimo_aluno", String(id));
  }

  useEffect(() => {
    if (!turma) return;
    setLancamentos(null);
    api
      .get<AlunoResumo[]>(`/faltas/alunos-turma?turma=${encodeURIComponent(turma)}`)
      .then((lista) => {
        setAlunos(lista);
        const ultimoId = Number(localStorage.getItem("sgd_notas_ultimo_aluno") ?? "");
        setAlunoId(lista.some((a) => a.id === ultimoId) ? ultimoId : "");
      });
  }, [turma]);

  async function verBoletimAnual() {
    if (!alunoId || alunoId === "todos") return;
    setCarregandoBoletimAnual(true);
    setBoletimAnual(null);
    try {
      const resultado = await api.get<BoletimAnualAluno>(
        `/boletim-anual?turma=${encodeURIComponent(turma)}&aluno_id=${alunoId}`
      );
      setBoletimAnual(resultado);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao gerar boletim anual");
    } finally {
      setCarregandoBoletimAnual(false);
    }
  }

  async function consultar() {
    if (!alunoId || !disciplinaId) return;
    setLancamentos(null);
    setBoletim(null);
    setBoletimTurma(null);
    setBoletimAnual(null);
    setFaltasDetalhe(null);
    setRegistrosDisciplinares(null);
    setAlunoDetalhe(null);
    try {
      const boletimParams = new URLSearchParams({ turma, disciplina_id: String(disciplinaId) });
      if (dataInicio) boletimParams.set("data_inicio", dataInicio);
      if (dataFim) boletimParams.set("data_fim", dataFim);

      if (alunoId === "todos") {
        const [boletins, todosAlunos] = await Promise.all([
          api.get<BoletimAluno[]>(`/boletim?${boletimParams.toString()}`),
          api.get<Aluno[]>("/alunos"),
        ]);
        setBoletimTurma(boletins);
        setAlunosTurmaCompletos(todosAlunos);
        return;
      }

      const params = new URLSearchParams({ disciplina_id: String(disciplinaId) });
      if (dataInicio) params.set("data_inicio", dataInicio);
      if (dataFim) params.set("data_fim", dataFim);
      boletimParams.set("aluno_id", String(alunoId));

      const [lista, boletins, faltas, registros, alunoCompleto] = await Promise.all([
        api.get<LancamentoAlunoRead[]>(`/alunos/${alunoId}/lancamentos?${params.toString()}`),
        api.get<BoletimAluno[]>(`/boletim?${boletimParams.toString()}`),
        api.get<FaltaRead[]>(`/faltas?aluno_id=${alunoId}&disciplina_id=${disciplinaId}`),
        api.get<RegistroDisciplinar[]>(`/registros?aluno_id=${alunoId}`),
        api.get<Aluno>(`/alunos/${alunoId}`),
      ]);
      setLancamentos(lista);
      setBoletim(boletins[0] ?? null);
      setFaltasDetalhe(faltas.filter((f) => (!dataInicio || f.data >= dataInicio) && (!dataFim || f.data <= dataFim)));
      setRegistrosDisciplinares(registros);
      setAlunoDetalhe(alunoCompleto);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao consultar lançamentos");
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <PageHeader
        title="Consultas"
        subtitle="Veja, em um período, quais atividades foram lançadas, o que o aluno entregou, faltas e a nota final calculada."
      />

      <Card>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Turma</Label>
              <Select value={turma} onValueChange={(v) => v && selecionarTurma(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: string) => (v ? `Turma ${v}` : "Turma")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {turmas.map((t) => (
                    <SelectItem key={t} value={t}>
                      Turma {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Aluno</Label>
              <Select value={String(alunoId)} onValueChange={(v) => selecionarAluno(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string) => {
                      if (!v) return "Selecione...";
                      if (v === "todos") return "Todos os alunos da turma";
                      return alunos.find((a) => String(a.id) === v)?.nome ?? "Selecione...";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os alunos da turma</SelectItem>
                  {alunos.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs value={aba} onValueChange={(v) => v && setAba(v as "periodo" | "anual")}>
            <TabsList>
              <TabsTrigger value="periodo">Boletim do período</TabsTrigger>
              <TabsTrigger value="anual">Boletim anual</TabsTrigger>
            </TabsList>

            <TabsContent value="periodo">
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Disciplina</Label>
                  <Select value={disciplinaId ? String(disciplinaId) : ""} onValueChange={(v) => v && selecionarDisciplina(Number(v))}>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string) => (v ? disciplinasDisponiveis.find((d) => String(d.disciplina_id) === v)?.disciplina_nome : "Disciplina")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {disciplinasDisponiveis.map((d) => (
                        <SelectItem key={d.disciplina_id} value={String(d.disciplina_id)}>
                          {d.disciplina_nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Período de</Label>
                  <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                </div>

                <div className="space-y-1">
                  <Label>até</Label>
                  <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                </div>
              </div>

              <Button onClick={consultar} disabled={!alunoId || !disciplinaId}>
                Consultar
              </Button>
            </TabsContent>

            <TabsContent value="anual">
              <Button
                variant="outline"
                onClick={verBoletimAnual}
                disabled={!alunoId || alunoId === "todos" || carregandoBoletimAnual}
              >
                {carregandoBoletimAnual ? "Gerando..." : "Ver boletim anual"}
              </Button>
              {alunoId === "todos" && (
                <p className="text-xs text-muted-foreground mt-2">
                  Selecione um aluno específico (não "todos") para ver o boletim anual.
                </p>
              )}

              {boletimAnual && (
                <Card className="mt-4">
                  <CardHeader className="flex-row items-center justify-between border-b pb-3">
                    <CardTitle>Boletim anual — {boletimAnual.aluno_nome}</CardTitle>
                    <Button size="sm" onClick={() => gerarPdfBoletim(boletimAnual, turma)}>
                      <Download />
                      Baixar PDF
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {boletimAnual.disciplinas.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma disciplina atribuída a essa turma ainda.
                      </p>
                    ) : (
                      boletimAnual.disciplinas.map((disc) => (
                        <div key={disc.disciplina_id} className="rounded-lg border">
                          <div className="px-3 py-2 border-b flex items-center justify-between bg-muted/40 rounded-t-lg">
                            <span className="text-sm font-semibold text-foreground">{disc.disciplina_nome}</span>
                            <Badge className={disc.aprovado ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
                              {disc.aprovado ? "Aprovado" : "Reprovado"}
                            </Badge>
                          </div>
                          <div className="divide-y">
                            {disc.trimestres.map((t) => (
                              <div key={t.trimestre} className="px-3 py-2 flex items-center justify-between gap-4">
                                <span className="text-sm text-foreground">
                                  {t.trimestre}º trimestre
                                  <span className="text-xs text-muted-foreground">
                                    {" "}
                                    ({formatarData(t.data_inicio)} a {formatarData(t.data_fim)})
                                  </span>
                                </span>
                                <span className="text-xs text-muted-foreground">{t.total_faltas} falta(s)</span>
                                <span className="text-sm font-bold text-foreground" title={t.ajuste_motivo ?? undefined}>
                                  {t.nota_ajustada !== null ? (
                                    <>
                                      <span className="text-muted-foreground line-through font-normal">{t.nota_calculada}</span>{" "}
                                      {t.nota_ajustada}
                                    </>
                                  ) : (
                                    t.nota_calculada
                                  )}{" "}
                                  / {t.peso_total}
                                </span>
                                <AjusteNotaDialog
                                  alunoId={boletimAnual.aluno_id}
                                  disciplinaId={disc.disciplina_id}
                                  trimestre={t.trimestre}
                                  ajusteAtual={
                                    t.ajuste_id !== null
                                      ? { id: t.ajuste_id, nota_ajustada: t.nota_ajustada as number, motivo: t.ajuste_motivo }
                                      : null
                                  }
                                  onSalvo={verBoletimAnual}
                                />
                              </div>
                            ))}
                          </div>
                          <div className="px-3 py-2 border-t flex items-center justify-between">
                            <span className="text-sm font-semibold text-foreground">Média final: {disc.media_final}</span>
                            <span className="text-sm text-muted-foreground">{disc.total_faltas} falta(s) no ano</span>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {aba === "periodo" && boletimTurma && (
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle>Boletim da turma — nota final do período</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {boletimTurma.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum aluno encontrado nessa turma.</p>
            ) : (
              boletimTurma.map((b) => {
                const alunoCompleto = alunosCompletosPorId.get(b.aluno_id);
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
      )}

      {aba === "periodo" && boletim && (
        <Card>
          <CardHeader className="flex-row items-center justify-between border-b pb-3">
            <CardTitle>Boletim do período</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{boletim.total_faltas} falta(s)</span>
              <span className="text-sm font-bold text-foreground">
                {boletim.nota_final} / {boletim.peso_total}
              </span>
            </div>
          </CardHeader>
          <CardContent className="divide-y">
            {boletim.grupos.map((g) => (
              <div key={g.categoria} className="py-2 flex items-center justify-between text-sm first:pt-0">
                <span className="text-muted-foreground">
                  {g.categoria} (peso {g.peso}) · {g.quantidade_atividades} atividade(s) · média {g.media}
                </span>
                <span className="font-medium text-foreground">{g.pontos} pts</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {aba === "periodo" && alunoDetalhe && (
        <Card>
          <CardHeader className="flex-row items-center justify-between border-b pb-3">
            <CardTitle>Faltas no período</CardTitle>
            <span className="text-xs text-muted-foreground">{faltasDetalhe?.length ?? 0} falta(s)</span>
          </CardHeader>
          <CardContent className="divide-y">
            {faltasDetalhe === null ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : faltasDetalhe.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma falta registrada no período.</p>
            ) : (
              [...faltasDetalhe]
                .sort((a, b) => (a.data < b.data ? 1 : -1))
                .map((f) => (
                  <div key={f.id} className="py-2 flex items-center justify-between text-sm first:pt-0">
                    <span className="text-foreground">{formatarData(f.data)}</span>
                    <Badge className={f.justificada ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
                      {f.justificada ? "justificada" : "não justificada"}
                    </Badge>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      )}

      {aba === "periodo" && alunoDetalhe && (
        <Card>
          <CardHeader className="flex-row items-center justify-between border-b pb-3">
            <CardTitle>Disciplina</CardTitle>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{calcularStatus(alunoDetalhe.pontos_atuais, punicoes)}</Badge>
              <span className="text-sm font-bold text-foreground">{alunoDetalhe.pontos_atuais} pontos</span>
            </div>
          </CardHeader>
          <CardContent className="divide-y">
            {registrosDisciplinares === null ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : registrosDisciplinares.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma infração ou mérito registrado.</p>
            ) : (
              registrosDisciplinares.map((r) => (
                <div key={r.id} className="py-2 flex items-center justify-between gap-3 text-sm first:pt-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={r.tipo === "infracao" ? "destructive" : "secondary"}>
                        {r.tipo === "infracao" ? "Infração" : "Mérito"}
                      </Badge>
                      <span className="font-medium text-foreground">{r.descricao}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(r.data_hora).toLocaleString("pt-BR")}
                      {r.professor_nome ? ` — Professor(a): ${r.professor_nome}` : ""}
                      {r.observacao ? ` — ${r.observacao}` : ""}
                    </p>
                  </div>
                  <span className={`font-semibold shrink-0 ${r.peso >= 0 ? "text-destructive" : "text-emerald-600"}`}>
                    {r.peso >= 0 ? `+${r.peso}` : r.peso}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {aba === "periodo" && lancamentos !== null && (
        <Card>
          {lancamentos.length === 0 ? (
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Nenhum lançamento encontrado para esse aluno no período selecionado.
              </p>
            </CardContent>
          ) : (
            <ul className="divide-y">
              {lancamentos.map((l) => (
                <li key={l.id} className="px-(--card-spacing) py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{l.atividade_titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {ROTULOS_TIPO[l.atividade_tipo]} · lançada em {formatarData(l.atividade_data)}
                      {l.atividade_data_entrega && <> · entrega até {formatarData(l.atividade_data_entrega)}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-xs text-muted-foreground">
                      {l.fez === null ? "não registrado" : l.fez ? "fez" : "não fez"}
                      {l.entregue_em && <> · entregue em {formatarData(l.entregue_em)}</>}
                    </span>
                    <span className="text-sm font-semibold text-foreground w-10 text-right">{l.nota ?? "—"}</span>
                    <BadgePrazo noPrazo={l.no_prazo} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

export default function ConsultarAlunoPage() {
  return (
    <RequireAuth>
      <ConsultarAlunoContent />
    </RequireAuth>
  );
}
