"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth, rotaInicialPara } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      const usuario = await login(email, senha);
      router.push(usuario ? rotaInicialPara(usuario.papel) : "/painel");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao entrar");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-[#1e3a8a] via-[#1e40af] to-[#16a34a] p-6 w-full">
      <Card className="w-full max-w-sm shadow-xl">
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center mb-2">
              <Image
                src="/logo-mococa.jpg"
                alt="Prefeitura Municipal de Mococa"
                width={88}
                height={88}
                className="mx-auto mb-2 rounded-full shadow-sm"
              />
              <h1 className="text-xl font-bold text-foreground">SGD</h1>
              <p className="text-sm text-muted-foreground">Sistema de Gestão da Disciplina Escolar</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="senha">Senha</Label>
              <Input id="senha" type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
            </div>

            <Button type="submit" disabled={carregando} className="w-full">
              {carregando ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
