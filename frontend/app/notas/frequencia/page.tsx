"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { ChamadaAlunoStatus, ChamadaRead, ConteudoAulaRead, FaltaRead, FaltaResumoItem } from "@/lib/types";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

interface Edicao {
  ausente: boolean;
  justificada: boolean;
  observacao: string;
}

function edicoesIniciais(alunos: ChamadaAlunoStatus[]): Record<number, Edicao> {
  const mapa: Record<number, Edicao> = {};
  for (const a of alunos) {
    mapa[a.aluno_id] = { ausente: a.ausente, justificada: a.justificada, observacao: a.observacao ?? "" };
  }
  return mapa;
}

function FrequenciaContent() {
  const { turmas, disciplinasDaTurma } = useAtribuicoes();
  const [turma, setTurma] = useState("");
  const [disciplinaId, setDisciplinaId] = useState<number | "">("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));

  const [chamada, setChamada] = useState<ChamadaRead | null>(null);
  const [edicoes, setEdicoes] = useState<Record<number, Edicao>>({});
  const [conteudoAula, setConteudoAula] = useState("");
  const [carregandoChamada, setCarregandoChamada] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [resumo, setResumo] = useState<FaltaResumoItem[]>([]);
  const [diasPorAluno, setDiasPorAluno] = useState<Record<number, FaltaRead[]>>({});
  const [expandido, setExpandido] = useState<Record<number, boolean>>({});

  const [conteudos, setConteudos] = useState<ConteudoAulaRead[]>([]);
  const [mostrarConteudos, setMostrarConteudos] = useState(false);

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

  async function carregarChamada() {
    if (!turma || !disciplinaId || !data) return;
    setCarregandoChamada(true);
    try {
      const resultado = await api.get<ChamadaRead>(
        `/faltas/chamada?turma=${encodeURIComponent(turma)}&disciplina_id=${disciplinaId}&data=${data}`
      );
      setChamada(resultado);
      setEdicoes(edicoesIniciais(resultado.alunos));
      setConteudoAula(resultado.conteudo ?? "");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao carregar a chamada do dia");
    } finally {
      setCarregandoChamada(false);
    }
  }

  useEffect(() => {
    carregarChamada();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turma, disciplinaId, data]);

  async function carregarResumo() {
    if (!disciplinaId) return;
    const lista = await api.get<FaltaResumoItem[]>(
      `/faltas/resumo?disciplina_id=${disciplinaId}&turma=${encodeURIComponent(turma)}`
    );
    setResumo(lista);
  }

  async function carregarConteudos() {
    if (!turma || !disciplinaId) return;
    const lista = await api.get<ConteudoAulaRead[]>(
      `/faltas/conteudo?turma=${encodeURIComponent(turma)}&disciplina_id=${disciplinaId}`
    );
    setConteudos(lista);
  }

  useEffect(() => {
    carregarResumo();
    carregarConteudos();
    setDiasPorAluno({});
    setExpandido({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turma, disciplinaId]);

  async function alternarDiasFalta(alunoId: number) {
    const aberto = expandido[alunoId] ?? false;
    setExpandido((prev) => ({ ...prev, [alunoId]: !aberto }));
    if (!aberto && !diasPorAluno[alunoId]) {
      const lista = await api.get<FaltaRead[]>(`/faltas?aluno_id=${alunoId}&disciplina_id=${disciplinaId}`);
      setDiasPorAluno((prev) => ({ ...prev, [alunoId]: lista }));
    }
  }

  function alterarEdicao(alunoId: number, parcial: Partial<Edicao>) {
    setEdicoes((prev) => ({ ...prev, [alunoId]: { ...prev[alunoId], ...parcial } }));
  }

  async function salvarChamada() {
    if (!turma || !disciplinaId || !chamada) return;
    setSalvando(true);
    try {
      const faltas = chamada.alunos
        .filter((a) => edicoes[a.aluno_id]?.ausente)
        .map((a) => ({
          aluno_id: a.aluno_id,
          justificada: edicoes[a.aluno_id]?.justificada ?? false,
          observacao: edicoes[a.aluno_id]?.observacao?.trim() || null,
        }));

      const resultado = await api.post<ChamadaRead>("/faltas/chamada", {
        turma,
        disciplina_id: disciplinaId,
        data,
        conteudo: conteudoAula.trim() || null,
        faltas,
      });
      setChamada(resultado);
      setEdicoes(edicoesIniciais(resultado.alunos));
      setConteudoAula(resultado.conteudo ?? "");
      toast.success("Chamada salva com sucesso.");
      carregarResumo();
      carregarConteudos();
      setDiasPorAluno({});
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar a chamada");
    } finally {
      setSalvando(false);
    }
  }

  const resumoDaTurma = resumo.filter((r) => chamada?.alunos.some((a) => a.aluno_id === r.aluno_id));
  const disciplinaAtual = disciplinasDisponiveis.find((d) => d.disciplina_id === disciplinaId);
  const totalAusentes = Object.values(edicoes).filter((e) => e.ausente).length;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <PageHeader
        title="Controle de Frequência"
        subtitle="Faça a chamada, descreva o conteúdo dado no dia e edite a frequência de qualquer data quando precisar."
      />

      <Card>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3 items-end">
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
              <Label title="Escolha qualquer data para ver ou editar a chamada já feita naquele dia.">Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          {turma && disciplinasDisponiveis.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Você não tem nenhuma disciplina atribuída nessa turma. Fale com a coordenação.
            </p>
          )}

          {disciplinaAtual && (
            <div className="space-y-1">
              <Label title="O que foi ensinado nessa aula. Fica salvo para consulta depois.">
                Conteúdo dado nessa aula
              </Label>
              <Textarea
                value={conteudoAula}
                onChange={(e) => setConteudoAula(e.target.value)}
                placeholder="Ex: Equações do 1º grau — exercícios 1 a 10 do livro"
                rows={2}
              />
            </div>
          )}

          {carregandoChamada && <p className="text-sm text-muted-foreground">Carregando chamada do dia...</p>}

          {disciplinaAtual && !carregandoChamada && chamada && chamada.alunos.length > 0 && (
            <Card size="sm">
              <ul className="divide-y">
                {chamada.alunos.map((a) => {
                  const edicao = edicoes[a.aluno_id];
                  return (
                    <li key={a.aluno_id} className="px-(--card-spacing) py-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-foreground">
                          {a.numero_chamada !== null && (
                            <span className="text-muted-foreground">{a.numero_chamada}. </span>
                          )}
                          {a.aluno_nome} <span className="text-muted-foreground">({a.matricula})</span>
                        </span>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                          Faltou
                          <input
                            type="checkbox"
                            checked={edicao?.ausente ?? false}
                            onChange={(e) => alterarEdicao(a.aluno_id, { ausente: e.target.checked })}
                            className="size-4 accent-primary"
                          />
                        </label>
                      </div>
                      {edicao?.ausente && (
                        <div className="flex items-center gap-3 pl-1">
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                            <input
                              type="checkbox"
                              checked={edicao.justificada}
                              onChange={(e) => alterarEdicao(a.aluno_id, { justificada: e.target.checked })}
                              className="size-3.5 accent-primary"
                            />
                            Justificada
                          </label>
                          <Input
                            value={edicao.observacao}
                            onChange={(e) => alterarEdicao(a.aluno_id, { observacao: e.target.value })}
                            placeholder="Observação (opcional)"
                            className="h-7 text-xs flex-1"
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {chamada ? `${totalAusentes} de ${chamada.alunos.length} faltando` : ""}
            </span>
            <Button onClick={salvarChamada} disabled={salvando || !chamada} variant="merito">
              {salvando ? "Salvando..." : "Salvar chamada"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {disciplinaAtual && resumoDaTurma.length > 0 && (
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle>
              Total de faltas — Turma {turma} · {disciplinaAtual.disciplina_nome}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {resumoDaTurma.map((r) => (
              <div key={r.aluno_id} className="py-2 first:pt-0">
                <button
                  type="button"
                  onClick={() => alternarDiasFalta(r.aluno_id)}
                  className="w-full flex items-center justify-between text-sm hover:text-foreground"
                >
                  <span className="text-foreground flex items-center gap-1">
                    {expandido[r.aluno_id] ? (
                      <ChevronDown className="size-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                    )}
                    {r.aluno_nome}
                  </span>
                  <span className="font-medium text-muted-foreground">{r.total_faltas} falta(s)</span>
                </button>
                {expandido[r.aluno_id] && (
                  <ul className="mt-1.5 ml-5 space-y-1">
                    {(diasPorAluno[r.aluno_id] ?? []).map((f) => (
                      <li key={f.id} className="text-xs text-muted-foreground flex items-center justify-between gap-2">
                        <span>{formatarData(f.data)}</span>
                        <span>
                          {f.justificada ? "justificada" : "não justificada"}
                          {f.observacao && <> · {f.observacao}</>}
                        </span>
                      </li>
                    ))}
                    {(diasPorAluno[r.aluno_id] ?? []).length === 0 && (
                      <li className="text-xs text-muted-foreground">Carregando...</li>
                    )}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {disciplinaAtual && (
        <Card>
          <CardHeader className="flex-row items-center justify-between border-b pb-3">
            <CardTitle>Conteúdo programático — o que foi dado em cada aula</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={() => setMostrarConteudos((v) => !v)}>
              {mostrarConteudos ? "Ocultar" : "Ver tudo"}
            </Button>
          </CardHeader>
          {mostrarConteudos && (
            <CardContent className="divide-y">
              {conteudos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum conteúdo registrado ainda nessa turma/disciplina.</p>
              ) : (
                conteudos.map((c) => (
                  <div key={c.id} className="py-2 first:pt-0 space-y-0.5">
                    <span className="text-xs font-medium text-muted-foreground">{formatarData(c.data)}</span>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{c.conteudo}</p>
                  </div>
                ))
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

export default function FrequenciaPage() {
  return (
    <RequireAuth>
      <FrequenciaContent />
    </RequireAuth>
  );
}
