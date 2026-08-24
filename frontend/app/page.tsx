"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, rotaInicialPara } from "@/lib/auth";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.push(user ? rotaInicialPara(user.papel) : "/login");
  }, [loading, user, router]);

  return null;
}
