import { AppPermissionsBanner } from "@/components/pwa/app-permissions-banner";
import { ReactNode, useEffect, useState } from "react";
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
  Menu,
  ChevronLeft,
  Heart,
  FolderKanban,
  UserSearch,
  Globe,
  Award,
  Building2,
  ClipboardList,
  MessageSquare,
  MessageSquareQuote,
  Handshake,
  Flag,
  Briefcase as BriefcaseIcon,
  ShoppingBag,
  UploadCloud,
  Rss,
  IdCard,
  DollarSign,
  Newspaper,
  Ticket,
} from "lucide-react";
import { useSiteModules } from "@/lib/modules";
import { useAmbassadorAreas, hasAreaAccess, hasActionAccess } from "@/lib/ambassador-areas";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown, BellRing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, signOut } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/dashboard/notifications-bell";
import { CommandPalette, useCommandPalette } from "@/components/dashboard/command-palette";
import { useIsMobile } from "@/hooks/use-mobile";

const ROLE_META: Record<string, { label: string; icon: any; className: string }> = {
  SUPER_ADMIN: { label: "SUPER ADMIN", icon: Crown, className: "border-secondary text-secondary shadow-[0_0_20px_hsl(var(--secondary)/0.4)]" },
  ADMIN: { label: "ADMIN", icon: ShieldCheck, className: "border-primary text-primary shadow-[0_0_20px_hsl(var(--primary)/0.4)]" },
  MODERADOR: { label: "MODERADOR", icon: Sparkles, className: "border-accent text-accent" },
  RECRUTADOR: { label: "RECRUTADOR", icon: Building2, className: "border-accent text-accent shadow-[0_0_18px_hsl(var(--accent)/0.35)]" },
  EMBAIXADOR: { label: "EMBAIXADOR", icon: Award, className: "border-secondary text-secondary shadow-[0_0_18px_hsl(var(--secondary)/0.35)]" },
  MEMBRO: { label: "MEMBRO", icon: UserIcon, className: "border-muted text-muted-foreground" },
};

export type DashRoles = string[];

export function useDashboardRoles() {
  const { user } = useAuth();
  const { data: roles = [], isLoading: rolesLoading, isFetched: rolesFetched } = useQuery({
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
  const isRecruiter = roles.includes("RECRUTADOR");
  const isAmbassador = roles.includes("EMBAIXADOR");
  const primary = isSuperAdmin
    ? "SUPER_ADMIN"
    : roles.includes("ADMIN")
    ? "ADMIN"
    : roles.includes("MODERADOR")
    ? "MODERADOR"
    : isAmbassador
    ? "EMBAIXADOR"
    : isRecruiter
    ? "RECRUTADOR"
    : "MEMBRO";
  return { user, roles, isAdmin, isSuperAdmin, isRecruiter, isAmbassador, primary, profile, rolesLoading, rolesReady: !!user?.id && rolesFetched };
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

export function useAmbassadorCan() {
  const { user, isAmbassador, isAdmin, rolesReady } = useDashboardRoles();
  const { areas, ready } = useAmbassadorAreas(user?.id, isAmbassador && !isAdmin);
  return { areas, ready: rolesReady && ready, can: (area: string, action?: string) => isAdmin || (isAmbassador && (action ? hasActionAccess(areas, area, action) : hasAreaAccess(areas, area))) };
}

type NavItem = { to: string; label: string; icon: any; show: boolean };
type NavSection = { key: string; heading?: string; items: NavItem[] };

export function DashboardShell({ children, title, description }: { children: ReactNode; title: string; description?: string }) {
  const navigate = useNavigate();
  const { loading, isAuthenticated } = useAuth();
  const { isAdmin, isSuperAdmin, isRecruiter, isAmbassador, primary, profile, user } = useDashboardRoles();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const palette = useCommandPalette();
  const { rafflesEnabled } = useSiteModules();
  const { can } = useAmbassadorCan();
  const ambOnly = isAmbassador && !isAdmin;
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try { setCollapsed(JSON.parse(localStorage.getItem("gti-nav-collapsed") ?? "{}")); } catch { /* ignore */ }
  }, []);
  const toggleSection = (k: string) => setCollapsed((c) => {
    const n = { ...c, [k]: !c[k] };
    try { localStorage.setItem("gti-nav-collapsed", JSON.stringify(n)); } catch { /* ignore */ }
    return n;
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate({ to: "/login" });
  }, [loading, isAuthenticated, navigate]);

  // Open by default on desktop, closed on mobile.
  useEffect(() => { setOpen(!isMobile); }, [isMobile]);
  // Close overlay sidebar on route change when in modal mode.
  useEffect(() => { if (isMobile) setOpen(false); }, [pathname, isMobile]);

  const sections: Omit<NavSection, "key">[] = [
    {
      items: [
        { to: "/dashboard", label: "Visão Geral", icon: LayoutDashboard, show: true },
        { to: "/dashboard/perfil", label: "Meu Perfil", icon: UserIcon, show: true },
        { to: "/dashboard/mensagens", label: "Mensagens", icon: MessageSquare, show: true },
        { to: "/dashboard/feed", label: "Feed", icon: Rss, show: true },
        { to: "/dashboard/noticias", label: "Notícias", icon: Newspaper, show: true },
        { to: "/dashboard/notificacoes", label: "Notificações", icon: BellRing, show: true },
      ],
    },
    {
      heading: "COMUNIDADE",
      items: [
        { to: "/dashboard/meus-projetos", label: "Meus Projetos", icon: FolderKanban, show: true },
        { to: "/dashboard/explorar-projetos", label: "Explorar Projetos", icon: Globe, show: true },
        { to: "/drops", label: "Drops", icon: ShoppingBag, show: true },
        { to: "/dashboard/depoimentos", label: "Depoimentos", icon: MessageSquareQuote, show: true },
        { to: "/dashboard/rifas", label: "Rifas", icon: Ticket, show: rafflesEnabled },
      ],
    },
    {
      heading: "MEMBRO",
      items: [
        { to: "/vagas", label: "Explorar Vagas", icon: BriefcaseIcon, show: !isAdmin && !isRecruiter },
        { to: "/dashboard/minhas-vagas", label: "Vagas Salvas", icon: Heart, show: !isAdmin && !isRecruiter },
        { to: "/dashboard/candidaturas", label: "Minhas Candidaturas", icon: ClipboardList, show: !isAdmin && !isRecruiter },
        { to: "/dashboard/meus-eventos", label: "Meus Eventos", icon: Calendar, show: !isAdmin },
        { to: "/dashboard/sugerir-evento", label: "Sugerir Evento", icon: Calendar, show: !isAdmin },
      ],
    },
    {
      heading: "EMBAIXADOR",
      items: [
        { to: "/dashboard/eventos", label: "Eventos", icon: Calendar, show: ambOnly && can("eventos") },
        { to: "/dashboard/vagas", label: "Vagas", icon: Briefcase, show: ambOnly && can("vagas") },
        { to: "/dashboard/parceiros", label: "Parceiros", icon: Handshake, show: ambOnly && can("parceiros") },
        { to: "/dashboard/candidatos", label: "Candidatos", icon: UserSearch, show: ambOnly && can("candidatos") && !isRecruiter },
        { to: "/dashboard/denuncias", label: "Denúncias", icon: Flag, show: ambOnly && can("denuncias") },
        { to: "/dashboard/comunidade-perfis", label: "Meu cartão de embaixador", icon: IdCard, show: ambOnly },
      ],
    },
    {
      heading: "RECRUTADOR",
      items: [
        { to: "/dashboard/vagas", label: "Minhas Vagas", icon: Briefcase, show: isRecruiter && !isAdmin },
        { to: "/dashboard/candidatos", label: "Candidatos", icon: UserSearch, show: isRecruiter || isAdmin },
      ],
    },
    {
      heading: "ADMINISTRAÇÃO",
      items: [
        { to: "/dashboard/usuarios", label: "Usuários", icon: Users, show: isAdmin },
        { to: "/dashboard/vagas", label: "Vagas", icon: Briefcase, show: isAdmin },
        { to: "/dashboard/eventos", label: "Eventos", icon: Calendar, show: isAdmin },
        { to: "/dashboard/projetos", label: "Projetos / Squads", icon: FolderKanban, show: isAdmin },
        { to: "/dashboard/parceiros", label: "Parceiros", icon: Handshake, show: isAdmin },
        { to: "/dashboard/comunidade-perfis", label: "Embaixadores/Admins", icon: IdCard, show: isAdmin },
        { to: "/dashboard/denuncias", label: "Denúncias", icon: Flag, show: isAdmin },
        { to: "/dashboard/configuracoes", label: "Configurações do Site", icon: Settings, show: isAdmin },
        { to: "/dashboard/drops", label: "Drops", icon: ShoppingBag, show: isAdmin },
        { to: "/dashboard/financeiro", label: "Financeiro", icon: DollarSign, show: isAdmin },
        
        { to: "/dashboard/rifas-admin", label: "Rifas", icon: Ticket, show: isAdmin && rafflesEnabled },
        { to: "/dashboard/logs", label: "Logs de Auditoria", icon: FileText, show: isAdmin },
      ],
    },
    {
      heading: "SUPER ADMIN",
      items: [
        { to: "/dashboard/cargos", label: "Cargos / Badges", icon: Award, show: isSuperAdmin },
        { to: "/dashboard/upload-config", label: "Config. de Upload", icon: UploadCloud, show: isSuperAdmin },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Backdrop for mobile/overlay mode */}
      {open && isMobile && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden"
        />
      )}
      <aside
        className={cn(
          "border-r border-border/40 bg-background/95 backdrop-blur overflow-hidden",
          isMobile
            ? cn(
                "fixed inset-y-0 left-0 z-50 h-screen w-[280px] shadow-2xl transition-transform duration-300",
                open ? "translate-x-0" : "-translate-x-full",
              )
            : cn(
                "shrink-0 sticky top-0 h-screen transition-[width] duration-300",
                open ? "w-[260px]" : "w-[68px]",
              ),
        )}
      >
        <div className="h-full flex flex-col p-3">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/40">
            {(open || isMobile) ? (
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-gradient-neon flex items-center justify-center font-black text-background text-sm">{"</>"}</div>
                <div className="leading-none">
                  <div className="font-black tracking-tight text-sm">GALERA</div>
                  <div className="text-[9px] font-bold tracking-[0.3em] text-gradient-neon">DASHBOARD</div>
                </div>
              </div>
            ) : (
              <div className="h-8 w-8 rounded-md bg-gradient-neon" />
            )}
            <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label={open ? "Fechar menu" : "Abrir menu"}>
              {open ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
          {(open || isMobile) && (
            <div className="flex items-center gap-3 pb-3 mb-2 border-b border-border/40">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-10 h-10 shrink-0 rounded-full object-cover ring-2 ring-primary/40" />
              ) : (
                <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-black text-background">
                  {(profile?.display_name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{profile?.display_name ?? "Membro"}</div>
                <div className="text-[10px] text-muted-foreground truncate">{user?.email}</div>
                <div className="mt-1"><RoleBadge role={primary} /></div>
              </div>
            </div>
          )}
          {(open || isMobile) && (
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar no menu…" className="h-8 pl-8 text-xs" aria-label="Buscar no menu" />
            </div>
          )}
          <nav className="space-y-2 flex-1 overflow-y-auto pr-1 -mr-1" aria-label="Menu do painel">
            {sections.map((section, idx) => {
              const q = query.trim().toLowerCase();
              const visible = section.items.filter((i) => i.show && (!q || i.label.toLowerCase().includes(q)));
              if (visible.length === 0) return null;
              const showLabels = open || isMobile;
              const key = section.heading ?? `s${idx}`;
              const hasActive = visible.some((i) => pathname === i.to || pathname.startsWith(i.to + "/"));
              const isCollapsed = !!section.heading && !!collapsed[key] && !q && !hasActive;
              return (
                <div key={key} className={cn("space-y-0.5", idx > 0 && showLabels && "pt-2 border-t border-border/30")}>
                  {showLabels && section.heading && (
                    <button
                      type="button"
                      onClick={() => toggleSection(key)}
                      aria-expanded={!isCollapsed}
                      className="w-full flex items-center justify-between px-3 py-1 text-[10px] font-bold tracking-[0.2em] text-muted-foreground/70 hover:text-foreground transition"
                    >
                      <span>{section.heading}</span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-[9px] tracking-normal font-medium opacity-70">{visible.length}</span>
                        <ChevronDown className={cn("h-3 w-3 transition-transform", isCollapsed && "-rotate-90")} />
                      </span>
                    </button>
                  )}
                  {!isCollapsed && visible.map((i) => {
                    const active = pathname === i.to || (i.to !== "/dashboard" && pathname.startsWith(i.to + "/"));
                    const Icon = i.icon;
                    return (
                      <Link
                        key={`${key}-${i.to}`}
                        to={i.to}
                        title={i.label}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition",
                          active
                            ? "bg-primary/15 text-primary font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                          !showLabels && "justify-center px-2",
                        )}
                      >
                        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />}
                        <Icon className={cn("h-4 w-4 shrink-0 transition", !active && "group-hover:scale-110")} />
                        {showLabels && <span className="truncate">{i.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
            {query && sections.every((s) => s.items.every((i) => !i.show || !i.label.toLowerCase().includes(query.trim().toLowerCase()))) && (
              <p className="px-3 py-4 text-xs text-muted-foreground">Nada encontrado.</p>
            )}
          </nav>
          <Button
            variant="ghost"
            size="sm"
            className={cn("mt-3 text-muted-foreground", (open || isMobile) ? "justify-start" : "justify-center px-0")}
            onClick={() => signOut().then(() => navigate({ to: "/login" }))}
          >
            <LogOut className="h-4 w-4" />
            {(open || isMobile) && <span className="ml-2">Sair</span>}
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="container max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">
          <header className="mb-6 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 md:gap-4">
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            )}
            {!isMobile && <span />}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-gradient-neon truncate">{title}</h1>
              {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
            </div>
            <div className="shrink-0">
              <NotificationsBell />
            </div>
          </header>
          <AppPermissionsBanner />
          {children}
        </div>
      </main>
      <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />
    </div>
  );
}