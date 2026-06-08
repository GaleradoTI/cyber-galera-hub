import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crown, Layers, ArrowLeft, Globe, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/public/public-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/projetos/$slug")({
  component: PublicProjectPage,
  head: ({ params }) => ({
    meta: [
      { title: `Projeto ${params.slug} — Galera do T.I.` },
      { name: "description", content: `Conheça o projeto ${params.slug} da Galera do T.I.` },
    ],
  }),
});

type Project = { id: string; name: string; slug: string; description: string | null; cover_url: string | null; banner_url: string | null; status: string; is_public: boolean; tech_stack: string[] };
type Squad = { id: string; name: string; description: string | null; project_id: string };
type SquadMember = { id: string; squad_id: string; user_id: string; role_in_squad: string };
type Profile = { user_id: string; display_name: string; avatar_url: string | null };

function PublicProjectPage() {
  const { slug } = Route.useParams();

  const { data: project, isLoading, error } = useQuery({
    queryKey: ["public-project", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects").select("*").eq("slug", slug).eq("is_public", true).maybeSingle();
      if (error) throw error;
      return data as Project | null;
    },
  });

  const { data: squads = [] } = useQuery({
    queryKey: ["public-squads", project?.id],
    enabled: !!project?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("squads").select("*").eq("project_id", project!.id);
      if (error) throw error;
      return (data ?? []) as Squad[];
    },
  });

  const squadIds = squads.map((s) => s.id);

  const { data: members = [] } = useQuery({
    queryKey: ["public-squad-members", squadIds.join(",")],
    enabled: squadIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("squad_members").select("*").in("squad_id", squadIds);
      if (error) throw error;
      return (data ?? []) as SquadMember[];
    },
  });

  const userIds = Array.from(new Set(members.map((m) => m.user_id)));

  const { data: profiles = [] } = useQuery({
    queryKey: ["public-squad-profiles", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      // Usa a view pública para não expor email/social_links
      const { data, error } = await (supabase as any).from("public_profiles").select("user_id,display_name,avatar_url").in("user_id", userIds);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
  const profileById = new Map(profiles.map((p) => [p.user_id, p]));

  // Líder primeiro, depois ordem de cargo (role_in_squad alfabético), depois nome.
  const ROLE_ORDER: Record<string, number> = { LIDER: 0, MEMBRO: 2 };
  const sortMembers = (a: SquadMember, b: SquadMember) => {
    const ra = ROLE_ORDER[a.role_in_squad] ?? 1;
    const rb = ROLE_ORDER[b.role_in_squad] ?? 1;
    if (ra !== rb) return ra - rb;
    if (a.role_in_squad !== b.role_in_squad) return a.role_in_squad.localeCompare(b.role_in_squad);
    const na = profileById.get(a.user_id)?.display_name ?? "";
    const nb = profileById.get(b.user_id)?.display_name ?? "";
    return na.localeCompare(nb, "pt-BR");
  };

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="container max-w-4xl mx-auto px-4 py-10 space-y-4">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (error || !project) {
    return (
      <PublicLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <h1 className="text-2xl font-bold">Projeto não encontrado</h1>
            <p className="text-muted-foreground text-sm">Este projeto não existe ou não está público.</p>
            <Link to="/projetos" className="text-primary hover:underline text-sm">← Ver todos os projetos</Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: project.name, text: project.description ?? "", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado!");
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <PublicLayout>
      {/* Hero: usa banner quando disponível; senão gradiente com nome grande */}
      <div className="relative w-full h-48 sm:h-64 md:h-80 lg:h-96 overflow-hidden">
        {project.banner_url ? (
          <img
            src={project.banner_url}
            alt={`Banner do projeto ${project.name}`}
            className="w-full h-full object-cover"
            onError={(e) => ((e.currentTarget.style.display = "none"))}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-background to-secondary/40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 container max-w-4xl mx-auto px-4 py-4 md:py-6">
          <div className="text-[10px] sm:text-xs font-bold tracking-[0.3em] text-secondary mb-1 flex items-center gap-2">
            <Globe className="h-3 w-3" /> PROJETO PÚBLICO
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-gradient-neon leading-tight">
            {project.name}
          </h1>
        </div>
      </div>
      <article className="container max-w-4xl mx-auto px-4 py-6 md:py-10 animate-in fade-in duration-500">
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <Link to="/projetos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-3 w-3" /> Todos os projetos
          </Link>
          <Button size="sm" variant="outline" onClick={share}>
            <Share2 className="h-3 w-3 mr-1.5" /> Compartilhar
          </Button>
        </div>

        {project.description && <p className="text-muted-foreground mt-3 text-base md:text-lg leading-relaxed">{project.description}</p>}

        {project.tech_stack && project.tech_stack.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {project.tech_stack.map((t) => (
              <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/30">{t}</span>
            ))}
          </div>
        )}

        <h2 className="text-xs font-bold tracking-[0.3em] text-muted-foreground/70 mt-10 mb-4 flex items-center gap-2">
          <Layers className="h-3 w-3" /> SQUADS
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {squads.map((s) => {
            const ms = members.filter((m) => m.squad_id === s.id).sort(sortMembers);
            return (
              <div key={s.id} className="glass rounded-xl p-4 md:p-5 border border-primary/20">
                <h3 className="font-bold">{s.name}</h3>
                {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
                <div className="mt-3 space-y-1">
                  {ms.map((m) => {
                    const u = profileById.get(m.user_id);
                    return (
                      <div key={m.id} className="flex items-center gap-2 text-sm">
                        {u?.avatar_url ? (
                          <img src={u.avatar_url} alt="" loading="lazy" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/40 to-secondary/40 flex items-center justify-center text-[10px] font-black">
                            {(u?.display_name ?? "?").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate flex-1">{u?.display_name ?? "—"}</span>
                        {m.role_in_squad === "LIDER" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-secondary shrink-0">
                            <Crown className="h-3 w-3" /> LÍDER
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground shrink-0">{m.role_in_squad}</span>
                        )}
                      </div>
                    );
                  })}
                  {ms.length === 0 && <p className="text-xs text-muted-foreground">Sem membros ainda.</p>}
                </div>
              </div>
            );
          })}
          {squads.length === 0 && <p className="text-sm text-muted-foreground">Sem squads cadastrados ainda.</p>}
        </div>
      </article>
    </PublicLayout>
  );
}