"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { login as apiLogin } from "./api";
import { Papel } from "./types";

interface AuthUser {
  usuarioId: number;
  escolaId: number;
  papel: Papel;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<AuthUser | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function decodeToken(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return { usuarioId: Number(payload.sub), escolaId: payload.escola_id, papel: payload.papel };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("sgd_token");
    if (token) setUser(decodeToken(token));
    setLoading(false);
  }, []);

  async function login(email: string, senha: string) {
    const token = await apiLogin(email, senha);
    localStorage.setItem("sgd_token", token);
    const decodedUser = decodeToken(token);
    setUser(decodedUser);
    return decodedUser;
  }

  function logout() {
    localStorage.removeItem("sgd_token");
    setUser(null);
    router.push("/login");
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function rotaInicialPara(papel: Papel): string {
  return papel === "professor" ? "/alunos" : "/painel";
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
