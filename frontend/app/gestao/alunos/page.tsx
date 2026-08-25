"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { Aluno } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FormAluno {
  nome: string;
  matricula: string;
  turma: string;
  numero_chamada: string;
  whatsapp_responsavel: string;
  observacoes_condutas: string;
}

const FORM_VAZIO: FormAluno = {
  nome: "",
  matricula: "",
  turma: "",
  numero_chamada: "",
  whatsapp_responsavel: "",
  observacoes_condutas: "",
};

function alunoParaForm(aluno: Aluno): FormAluno {
  return {
    nome: aluno.nome,
    matricula: aluno.matricula,
    turma: aluno.turma ?? "",
    numero_chamada: aluno.numero_chamada !== null ? String(aluno.numero_chamada) : "",
    whatsapp_responsavel: aluno.whatsapp_responsavel ?? "",
    observacoes_condutas: aluno.observacoes_condutas ?? "",
  };
}

function AlunoForm({
  valores,
  onChange,
  onSubmit,
  onCancelar,
  salvando,
  modoEdicao,
  turmas,
}: {
  valores: FormAluno;
  onChange: (v: FormAluno) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancelar?: () => void;
  salvando: boolean;
  modoEdicao: boolean;
  turmas: string[];
}) {
  return (
    <Card>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <h2 className="font-bold text-foreground">{modoEdicao ? "Editar aluno" : "Novo aluno"}</h2>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[160px] space-y-1">
              <Label>Nome</Label>
              <Input required value={valores.nome} onChange={(e) => onChange({ ...valores, nome: e.target.value })} />
            </div>
            <div className="min-w-[120px] space-y-1">
              <Label title="Preenchida automaticamente com a próxima disponível; pode alterar se precisar.">Matrícula</Label>
              <Input required value={valores.matricula} onChange={(e) => onChange({ ...valores, matricula: e.target.value })} />
            </div>
            <div className="w-32 space-y-1">
              <Label>Turma</Label>
              <Select
                value={valores.turma || undefined}
                onValueChange={(v) => onChange({ ...valores, turma: v ?? "" })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: string) => v || "Selecione..."}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {turmas.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {turmas.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma turma cadastrada em Gestão → Turmas.</p>
              )}
            </div>
            <div className="w-28 space-y-1">
              <Label title="Número do aluno na chamada/diário de classe. Pode repetir entre turmas diferentes.">
                Nº da chamada
              </Label>
              <Input
                type="number"
                min="1"
                value={valores.numero_chamada}
                onChange={(e) => onChange({ ...valores, numero_chamada: e.target.value })}
                placeholder="Ex: 5"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>WhatsApp do responsável</Label>
            <Input
              value={valores.whatsapp_responsavel}
              onChange={(e) => onChange({ ...valores, whatsapp_responsavel: e.target.value })}
              placeholder="11999998888"
            />
          </div>
          <div className="space-y-1">
            <Label>Observações sobre o aluno</Label>
            <Textarea
              value={valores.observacoes_condutas}
              onChange={(e) => onChange({ ...valores, observacoes_condutas: e.target.value })}
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Button>
            {onCancelar && (
              <Button type="button" variant="outline" onClick={onCancelar}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

const TODAS_TURMAS = "todas";
const SEM_TURMA = "sem-turma";

function AlunosGestaoContent() {
  const [alunos, setAlunos] = useState<Aluno[] | null>(null);
  const [turmas, setTurmas] = useState<string[]>([]);
  const [turmaFiltro, setTurmaFiltro] = useState<string>(TODAS_TURMAS);
  const [criando, setCriando] = useState(false);
  const [formCriar, setFormCriar] = useState<FormAluno>(FORM_VAZIO);
  const [salvandoCriar, setSalvandoCriar] = useState(false);

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [formEditar, setFormEditar] = useState<FormAluno>(FORM_VAZIO);
  const [salvandoEditar, setSalvandoEditar] = useState(false);

  async function carregar() {
    const dados = await api.get<Aluno[]>("/alunos");
    setAlunos(dados.sort((a, b) => a.nome.localeCompare(b.nome)));
  }

  async function carregarTurmas() {
    setTurmas(await api.get<string[]>("/turmas"));
  }

  async function abrirNovoAluno() {
    setCriando(true);
    const turmaInicial = turmaFiltro !== TODAS_TURMAS && turmaFiltro !== SEM_TURMA ? turmaFiltro : "";
    try {
      const sugestao = await api.get<{ matricula: string }>("/alunos/proxima-matricula");
      setFormCriar({ ...FORM_VAZIO, matricula: sugestao.matricula, turma: turmaInicial });
    } catch {
      setFormCriar({ ...FORM_VAZIO, turma: turmaInicial });
    }
  }

  const alunosExibidos = (alunos ?? []).filter((a) => {
    if (turmaFiltro === TODAS_TURMAS) return true;
    if (turmaFiltro === SEM_TURMA) return !a.turma;
    return a.turma === turmaFiltro;
  });

  useEffect(() => {
    carregar();
    carregarTurmas();
  }, []);

  function paraPayload(v: FormAluno) {
    return {
      nome: v.nome,
      matricula: v.matricula,
      turma: v.turma || null,
      numero_chamada: v.numero_chamada ? Number(v.numero_chamada) : null,
      whatsapp_responsavel: v.whatsapp_responsavel || null,
      observacoes_condutas: v.observacoes_condutas || null,
    };
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setSalvandoCriar(true);
    try {
      await api.post("/alunos", paraPayload(formCriar));
      setFormCriar(FORM_VAZIO);
      setCriando(false);
      carregar();
      toast.success("Aluno cadastrado com sucesso");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao cadastrar aluno");
    } finally {
      setSalvandoCriar(false);
    }
  }

  function iniciarEdicao(aluno: Aluno) {
    setEditandoId(aluno.id);
    setFormEditar(alunoParaForm(aluno));
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (editandoId === null) return;
    setSalvandoEditar(true);
    try {
      await api.put(`/alunos/${editandoId}`, paraPayload(formEditar));
      setEditandoId(null);
      carregar();
      toast.success("Dados do aluno atualizados");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar aluno");
    } finally {
      setSalvandoEditar(false);
    }
  }

  async function excluir(id: number) {
    try {
      await api.delete(`/alunos/${id}`);
      carregar();
      toast.success("Aluno excluído");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao excluir aluno");
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <PageHeader
        title="Gestão de Alunos"
        action={
          !criando && (
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={turmaFiltro} onValueChange={(v) => setTurmaFiltro(v ?? TODAS_TURMAS)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS_TURMAS}>Todas as turmas</SelectItem>
                  {turmas.map((t) => (
                    <SelectItem key={t} value={t}>
                      Turma {t}
                    </SelectItem>
                  ))}
                  <SelectItem value={SEM_TURMA}>Sem turma</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={abrirNovoAluno}>+ Novo aluno</Button>
            </div>
          )
        }
      />

      {criando && (
        <AlunoForm
          valores={formCriar}
          onChange={setFormCriar}
          onSubmit={criar}
          onCancelar={() => {
            setCriando(false);
            setFormCriar(FORM_VAZIO);
          }}
          salvando={salvandoCriar}
          modoEdicao={false}
          turmas={turmas}
        />
      )}

      <div className="space-y-3">
        {alunos === null && <p className="text-muted-foreground">Carregando...</p>}
        {alunos !== null && alunosExibidos.length === 0 && (
          <p className="text-muted-foreground">Nenhum aluno encontrado nessa turma.</p>
        )}
        {alunosExibidos.map((aluno) =>
          editandoId === aluno.id ? (
            <AlunoForm
              key={aluno.id}
              valores={formEditar}
              onChange={setFormEditar}
              onSubmit={salvarEdicao}
              onCancelar={() => setEditandoId(null)}
              salvando={salvandoEditar}
              modoEdicao
              turmas={turmas}
            />
          ) : (
            <Card key={aluno.id}>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{aluno.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    Matrícula: {aluno.matricula}
                    {aluno.turma ? ` — Turma ${aluno.turma}` : ""}
                    {aluno.numero_chamada !== null ? ` — Nº ${aluno.numero_chamada}` : ""}
                    {aluno.whatsapp_responsavel ? ` — WhatsApp: ${aluno.whatsapp_responsavel}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => iniciarEdicao(aluno)}>
                    Editar
                  </Button>
                  <ConfirmDialog
                    trigger={<Button variant="destructive">Excluir</Button>}
                    title={`Excluir ${aluno.nome}?`}
                    description="Essa ação remove o cadastro do aluno permanentemente. Não é possível desfazer."
                    confirmLabel="Excluir"
                    onConfirm={() => excluir(aluno.id)}
                  />
                </div>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </div>
  );
}

export default function AlunosGestaoPage() {
  return (
    <RequireAuth papeisPermitidos={["admin_escola", "coordenacao"]}>
      <AlunosGestaoContent />
    </RequireAuth>
  );
}
