"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  BookOpen,
  Trophy,
  GraduationCap,
  Scale,
  ScrollText,
  Users,
  UserCog,
  LogOut,
  ListChecks,
  CalendarCheck,
  Search,
  BookMarked,
  Settings2,
  Tags,
  Layers,
  CalendarRange,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const ITENS_PRINCIPAIS = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard },
  { href: "/alunos", label: "Registro de Ocorrências", icon: ClipboardList },
  { href: "/historico", label: "Histórico", icon: BookOpen },
  { href: "/ranking", label: "Ranking de Mérito", icon: Trophy },
];

const ITENS_GESTAO = [
  { href: "/gestao/alunos", label: "Alunos", icon: GraduationCap },
  { href: "/gestao/turmas", label: "Turmas", icon: Layers },
  { href: "/gestao/anos-letivos", label: "Anos Letivos", icon: CalendarRange },
  { href: "/gestao/regras", label: "Regras", icon: Scale },
  { href: "/gestao/punicoes", label: "Condutas", icon: ScrollText },
  { href: "/gestao/professores", label: "Professores", icon: Users },
];

const ITENS_NOTAS = [
  { href: "/notas/atividades", label: "Registro de Atividades", icon: ListChecks },
  { href: "/notas/categorias", label: "Categorias", icon: Tags },
  { href: "/notas/frequencia", label: "Frequência", icon: CalendarCheck },
  { href: "/notas/consultar-aluno", label: "Consultas", icon: Search },
];

const ITENS_NOTAS_GESTAO = [
  { href: "/notas/disciplinas", label: "Disciplinas", icon: BookMarked },
  { href: "/notas/configuracoes", label: "Configuração", icon: Settings2 },
];

function NavItens({ itens }: { itens: typeof ITENS_PRINCIPAIS }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      {itens.map((item) => {
        const ativo = pathname === item.href || pathname?.startsWith(item.href + "/");
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              render={<Link href={item.href} />}
              isActive={ativo}
              tooltip={item.label}
              onClick={() => setOpenMobile(false)}
            >
              <item.icon />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function AppSidebar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const podeGerir = user.papel === "admin_escola" || user.papel === "coordenacao";
  const podeGerirUsuarios = user.papel === "admin_escola";

  const rotuloPapel = { admin_escola: "Admin da escola", coordenacao: "Coordenação", professor: "Professor" }[
    user.papel
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Image
            src="/logo-mococa.jpg"
            alt="Prefeitura de Mococa"
            width={32}
            height={32}
            className="rounded-full shrink-0"
          />
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-sidebar-foreground">SGD</span>
            <span className="text-xs text-sidebar-foreground/60">Disciplina e Notas</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <NavItens itens={ITENS_PRINCIPAIS} />
          </SidebarGroupContent>
        </SidebarGroup>

        {podeGerir && (
          <SidebarGroup>
            <SidebarGroupLabel>Gestão de cadastros</SidebarGroupLabel>
            <SidebarGroupContent>
              <NavItens
                itens={podeGerirUsuarios ? [...ITENS_GESTAO, { href: "/gestao/usuarios", label: "Usuários", icon: UserCog }] : ITENS_GESTAO}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Notas</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavItens itens={ITENS_NOTAS} />
          </SidebarGroupContent>
        </SidebarGroup>

        {podeGerir && (
          <SidebarGroup>
            <SidebarGroupLabel>Notas — Gestão</SidebarGroupLabel>
            <SidebarGroupContent>
              <NavItens itens={ITENS_NOTAS_GESTAO} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 group-data-[collapsible=icon]:hidden">
          <div className="flex flex-col leading-tight overflow-hidden">
            <span className="text-sm font-medium text-sidebar-foreground truncate">{rotuloPapel}</span>
          </div>
          <button
            onClick={logout}
            title="Sair"
            className="shrink-0 rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function MicrocenterFooter() {
  return (
    <footer className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground border-t bg-background">
      <span>Desenvolvido por</span>
      <Image src="/logo-microcenter.jpg" alt="Microcenter Informática" width={18} height={18} className="rounded" />
      <span className="font-medium">Microcenter Informática</span>
    </footer>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <div className="min-h-svh flex flex-col">
        <div className="flex-1 flex">{children}</div>
        <MicrocenterFooter />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <span className="font-semibold text-foreground">SGD</span>
          <span className="text-muted-foreground text-sm">Sistema de Gestão Escolar</span>
        </header>
        <main className="flex-1 bg-muted/30">{children}</main>
        <MicrocenterFooter />
      </SidebarInset>
    </SidebarProvider>
  );
}
