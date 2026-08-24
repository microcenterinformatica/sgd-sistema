"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { Professor, Usuario } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const SEM_USUARIO = "nenhum";

function SeletorUsuario({
  usuarios,
  value,
  onChange,
}: {
  usuarios: Usuario[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? SEM_USUARIO)}>
      <SelectTrigger className="w-full">
        <SelectValue>
          {(v: string) => (v === SEM_USUARIO || !v ? "Sem login vinculado" : usuarios.find((u) => String(u.id) === v)?.email)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SEM_USUARIO}>Sem login vinculado</SelectItem>
        {usuarios.map((u) => (
          <SelectItem key={u.id} value={String(u.id)}>
            {u.nome} ({u.email})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EditarProfessorDialog({
  professor,
  usuarios,
  onSalvo,
}: {
  professor: Professor;
  usuarios: Usuario[];
  onSalvo: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(professor.nome);
  const [usuarioId, setUsuarioId] = useState(professor.usuario_id ? String(professor.usuario_id) : SEM_USUARIO);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await api.put(`/professores/${professor.id}`, {
        nome,
        usuario_id: usuarioId === SEM_USUARIO ? null : Number(usuarioId),
      });
      toast.success("Professor atualizado com sucesso");
      setAberto(false);
      onSalvo();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar professor");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<span />}>
        <Button variant="outline">Editar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {professor.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label title="Vincule o login que esse professor usa para entrar no SGD-NOTAS, para que as notas e faltas fiquem restritas às disciplinas dele.">
              Usuário / login vinculado
            </Label>
            <SeletorUsuario usuarios={usuarios} value={usuarioId} onChange={setUsuarioId} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfessoresContent() {
  const [professores, setProfessores] = useState<Professor[] | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nome, setNome] = useState("");
  const [usuarioId, setUsuarioId] = useState(SEM_USUARIO);

  async function carregar() {
    const dados = await api.get<Professor[]>("/professores");
    setProfessores(dados.sort((a, b) => a.nome.localeCompare(b.nome)));
  }

  async function carregarUsuarios() {
    try {
      const dados = await api.get<Usuario[]>("/usuarios");
      setUsuarios(dados.filter((u) => u.papel === "professor" && u.ativo));
    } catch {
      // só admin_escola pode listar usuários; coordenação segue sem o seletor
      setUsuarios([]);
    }
  }

  useEffect(() => {
    carregar();
    carregarUsuarios();
  }, []);

  const usuariosPorId = new Map(usuarios.map((u) => [u.id, u]));

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/professores", {
        nome,
        usuario_id: usuarioId === SEM_USUARIO ? null : Number(usuarioId),
      });
      setNome("");
      setUsuarioId(SEM_USUARIO);
      carregar();
      toast.success("Professor cadastrado com sucesso");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar professor");
    }
  }

  async function excluir(id: number) {
    await api.delete(`/professores/${id}`);
    carregar();
    toast.success("Professor excluído");
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <PageHeader
        title="Professores"
        subtitle="Vincule cada professor ao login que ele usa para entrar, para restringir notas e faltas às disciplinas dele no SGD-NOTAS."
      />

      <Card>
        <CardContent>
          <form onSubmit={criar} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label>Nome</Label>
              <Input required value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[220px] space-y-1">
              <Label>Usuário / login vinculado</Label>
              <SeletorUsuario usuarios={usuarios} value={usuarioId} onChange={setUsuarioId} />
            </div>
            <Button type="submit">Adicionar</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardContent className="divide-y px-0">
          {professores?.map((p) => {
            const usuarioVinculado = p.usuario_id ? usuariosPorId.get(p.usuario_id) : undefined;
            return (
              <div key={p.id} className="flex items-center justify-between p-4 gap-3">
                <div>
                  <p className="font-medium text-foreground">{p.nome}</p>
                  {p.usuario_id ? (
                    <p className="text-sm text-muted-foreground">{usuarioVinculado?.email ?? "login vinculado"}</p>
                  ) : (
                    <Badge variant="secondary">Sem login vinculado</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <EditarProfessorDialog professor={p} usuarios={usuarios} onSalvo={carregar} />
                  <Button variant="destructive" onClick={() => excluir(p.id)}>
                    Excluir
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProfessoresPage() {
  return (
    <RequireAuth papeisPermitidos={["admin_escola", "coordenacao"]}>
      <ProfessoresContent />
    </RequireAuth>
  );
}
