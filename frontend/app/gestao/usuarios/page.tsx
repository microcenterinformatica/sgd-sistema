"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import RequireAuth from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { Papel, Usuario } from "@/lib/types";
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
import { ConfirmDialog } from "@/components/ConfirmDialog";

const PAPEIS: { valor: Papel; rotulo: string }[] = [
  { valor: "professor", rotulo: "Professor" },
  { valor: "coordenacao", rotulo: "Coordenação" },
  { valor: "admin_escola", rotulo: "Admin da escola" },
];

function EditarUsuarioDialog({ usuario, onSalvo }: { usuario: Usuario; onSalvo: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(usuario.nome);
  const [papel, setPapel] = useState<Papel>(usuario.papel);
  const [novaSenha, setNovaSenha] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      const dados: { nome: string; papel: Papel; senha?: string } = { nome, papel };
      if (novaSenha) dados.senha = novaSenha;
      await api.put(`/usuarios/${usuario.id}`, dados);
      toast.success("Usuário atualizado com sucesso");
      setAberto(false);
      setNovaSenha("");
      onSalvo();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar usuário");
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
          <DialogTitle>Editar {usuario.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Papel</Label>
            <Select value={papel} onValueChange={(v) => setPapel((v as Papel) ?? papel)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAPEIS.map((p) => (
                  <SelectItem key={p.valor} value={p.valor}>
                    {p.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Nova senha (opcional)</Label>
            <Input type="password" placeholder="Deixe em branco para manter a atual" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
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

function UsuariosContent() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<Papel>("professor");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    try {
      setUsuarios(await api.get<Usuario[]>("/usuarios"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao carregar usuários");
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.post("/usuarios", { nome, email, senha, papel });
      setNome("");
      setEmail("");
      setSenha("");
      setPapel("professor");
      carregar();
      toast.success("Usuário cadastrado com sucesso");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar usuário");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(usuario: Usuario) {
    try {
      await api.put(`/usuarios/${usuario.id}`, { ativo: !usuario.ativo });
      carregar();
      toast.success(usuario.ativo ? "Usuário desativado" : "Usuário ativado");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar usuário");
    }
  }

  const rotuloPapel = (p: Papel) => PAPEIS.find((item) => item.valor === p)?.rotulo ?? p;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <PageHeader title="Gestão de Usuários" />

      <Card>
        <CardContent>
          <form onSubmit={criar} className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[160px] space-y-1">
                <Label>Nome</Label>
                <Input required value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="flex-1 min-w-[200px] space-y-1">
                <Label>Email de login</Label>
                <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[160px] space-y-1">
                <Label>Senha</Label>
                <Input required type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Papel</Label>
                <Select value={papel} onValueChange={(v) => setPapel((v as Papel) ?? papel)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPEIS.map((p) => (
                      <SelectItem key={p.valor} value={p.valor}>
                        {p.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : "Cadastrar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardContent className="divide-y px-0">
          {usuarios === null && <p className="p-4 text-muted-foreground">Carregando...</p>}
          {usuarios?.map((u) => {
            const ehVoceMesmo = u.id === user?.usuarioId;
            return (
              <div key={u.id} className="flex items-center justify-between p-4 gap-3">
                <div>
                  <p className={`font-medium ${u.ativo ? "text-foreground" : "text-muted-foreground line-through"}`}>{u.nome}</p>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{rotuloPapel(u.papel)}</Badge>
                  {!u.ativo && <Badge variant="destructive">Inativo</Badge>}
                  <EditarUsuarioDialog usuario={u} onSalvo={carregar} />
                  {u.ativo ? (
                    <ConfirmDialog
                      trigger={
                        <Button variant="destructive" disabled={ehVoceMesmo} title={ehVoceMesmo ? "Você não pode desativar seu próprio usuário" : undefined}>
                          Desativar
                        </Button>
                      }
                      title={`Desativar ${u.nome}?`}
                      description="O usuário não conseguirá mais fazer login, mas todo o histórico de registros continua preservado."
                      confirmLabel="Desativar"
                      onConfirm={() => alternarAtivo(u)}
                    />
                  ) : (
                    <Button variant="success" onClick={() => alternarAtivo(u)}>
                      Ativar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

export default function UsuariosPage() {
  return (
    <RequireAuth papeisPermitidos={["admin_escola"]}>
      <UsuariosContent />
    </RequireAuth>
  );
}
