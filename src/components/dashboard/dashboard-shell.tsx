import { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Briefcase,
  Calendar,
  HelpCircle,
  MessageCircle,
  Users,
  Settings,
  FileText,
  LogOut,
  Crown,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, signOut } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/public/navbar";
import { Footer } from "@/components/public/footer";

const ROLE_META: Record<string, { label: string; icon: any; className: string }> = {
  SUPER_ADMIN: { label: "SUPER ADMIN", icon: Crown, className: "border-secondary text-secondary shadow-[0_0_20px_hsl(var(--secondary)/0.4)]" },
  ADMIN: { label: "ADMIN", icon: ShieldCheck, className: "border-primary text-primary shadow-[0_0_20px_hsl(var(--primary)/0.4)]" },
  MODERADOR: { label: "MODERADOR", icon: Sparkles, className: "border-accent text-accent" },
  MEMBRO: { label: "MEMBRO", icon: UserIcon, className: "border-muted text-muted-foreground" },
};

export type DashRoles = string[];

export function useDashboardRoles() {
  const { user } = useAuth();
  const { data: roles = [] } = useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data ?? []).map((r) => r.role as string);
    },
  });
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });
  const isSuperAdmin = roles.includes("SUPER_ADMIN");
  const isAdmin = isSuperAdmin || roles.includes("ADMIN");
  const primary = isSuperAdmin ? "SUPER_ADMIN" : roles.includes("ADMIN") ? "ADMIN" : roles.includes("MODERADOR") ? "MODERADOR" : "MEMBRO";
  return { user, roles, isAdmin, isSuperAdmin, primary, profile };
}

export function RoleBadge({ role }: { role: string }) {
  const meta = ROLE_META[role] ?? ROLE_META.MEMBRO;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-background/40 backdrop-blur ${meta.className}`}>
      <Icon className="h-3 w-3" />
      <span className="text-[10px] font-bold tracking-[0.2em]">{meta.label}</span>
    </span>
  );
}

export function DashboardShell({ children, title, description }: { children: ReactNode; title: string; description?: string }) {
  const navigate = useNavigate();
  const { loading, isAuthenticated } = useAuth();
  const { isAdmin, isSuperAdmin, primary, profile, user } = useDashboardRoles();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!loading && !isAuthenticated) {
    navigate({ to: "/login" });
  }

  const items = [
    { to: "/dashboard", label: "Visão Geral", icon: LayoutDashboard, show: true },
    { to: "/vagas", label: "Vagas", icon: Briefcase, show: true },
    { to: "/eventos", label: "Eventos", icon: Calendar, show: true },
    { to: "/canais", label: "Canais", icon: MessageCircle, show: true },
    { to: "/faq", label: "FAQ", icon: HelpCircle, show: true },
    { to: "/dashboard/usuarios", label: "Usuários", icon: Users, show: isAdmin },
    { to: "/dashboard/configuracoes", label: "Configurações do Site", icon: Settings, show: isAdmin },
    { to: "/dashboard/logs", label: "Logs de Auditoria", icon: FileText, show: isAdmin },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-[260px_1fr] gap-6">
          <aside className="lg:sticky lg:top-24 self-start">
            <div className="glass rounded-xl p-4 border border-primary/20">
              <div className="flex items-center gap-3 pb-4 border-b border-border/40">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-black text-background">
                  {(profile?.display_name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">{profile?.display_name ?? "Membro"}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{user?.email}</div>
                </div>
              </div>
              <div className="pt-3 pb-2">
                <RoleBadge role={primary} />
              </div>
              <nav className="space-y-1 mt-2">
                {items.filter((i) => i.show).map((i) => {
                  const active = pathname === i.to;
                  const Icon = i.icon;
                  return (
                    <Link
                      key={i.to}
                      to={i.to}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${
                        active
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{i.label}</span>
                      {(i.to === "/dashboard/configuracoes" || i.to === "/dashboard/usuarios") && isSuperAdmin && (
                        <span className="ml-auto text-[9px] font-bold tracking-[0.15em] text-secondary">SUPER</span>
                      )}
                    </Link>
                  );
                })}
              </nav>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start mt-3 text-muted-foreground"
                onClick={() => signOut().then(() => navigate({ to: "/" }))}
              >
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </Button>
            </div>
          </aside>
          <section className="min-w-0">
            <header className="mb-6">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-gradient-neon">{title}</h1>
              {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
            </header>
            {children}
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}