import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crown, Layers, ArrowLeft, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/projetos/$slug")({
  component: PublicProjectPage,
  head: ({ params }) => ({
    meta: [
      { title: `Projeto ${params.slug} — Galera do T.I.` },
      { name: "description", content: `Conheça o projeto ${params.slug} da Galera do T.I.` },
    ],
  }),
});

type Project = { id: string; name: string; slug: string; description: string | null; cover_url: string | null; status: string; is_public: boolean; tech_stack: string[] };
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
      const { data, error } = await supabase.from("profiles").select("user_id,display_name,avatar_url").in("user_id", userIds);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
  const profileById = new Map(profiles.map((p) => [p.user_id, p]));

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold">Projeto não encontrado</h1>
          <p className="text-muted-foreground text-sm">Este projeto não existe ou não está público.</p>
          <Link to="/" className="text-primary hover:underline text-sm">← Voltar ao início</Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-10">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>

        {project.cover_url && (
          <img src={project.cover_url} alt={project.name} className="w-full h-56 object-cover rounded-xl border border-border/40 mb-6" />
        )}

        <div className="flex items-center gap-2 text-xs text-secondary mb-2">
          <Globe className="h-3 w-3" /> <span className="font-bold tracking-[0.3em]">PROJETO PÚBLICO</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-gradient-neon">{project.name}</h1>
        {project.description && <p className="text-muted-foreground mt-3 text-lg">{project.description}</p>}

        {project.tech_stack && project.tech_stack.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {project.tech_stack.map((t) => (
              <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/30">{t}</span>
            ))}
          </div>
        )}

        <h2 className="text-sm font-bold tracking-[0.25em] text-muted-foreground/70 mt-10 mb-4 flex items-center gap-2">
          <Layers className="h-3 w-3" /> SQUADS
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          {squads.map((s) => {
            const ms = members.filter((m) => m.squad_id === s.id);
            return (
              <div key={s.id} className="glass rounded-xl p-5 border border-primary/20">
                <h3 className="font-bold">{s.name}</h3>
                {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
                <div className="mt-3 space-y-1">
                  {ms.map((m) => {
                    const u = profileById.get(m.user_id);
                    return (
                      <div key={m.id} className="flex items-center gap-2 text-sm">
                        {u?.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/40 to-secondary/40 flex items-center justify-center text-[10px] font-black">
                            {(u?.display_name ?? "?").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span>{u?.display_name ?? "—"}</span>
                        {m.role_in_squad === "LIDER" && <Crown className="h-3 w-3 text-secondary" />}
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
      </div>
    </main>
  );
}