"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Papel } from "@/lib/types";

export default function RequireAuth({
  children,
  papeisPermitidos,
}: {
  children: React.ReactNode;
  papeisPermitidos?: Papel[];
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="p-8 text-slate-500">Carregando...</div>;
  }

  if (papeisPermitidos && !papeisPermitidos.includes(user.papel)) {
    return (
      <div className="p-8 text-red-600">
        Você não tem permissão para acessar esta página.
      </div>
    );
  }

  return <>{children}</>;
}
