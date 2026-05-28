import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Search, ExternalLink, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/candidatos")({ component: CandidatosPage });

type Candidate = {
  user_id: string;
  display_name: string;
  email: string;
  bio: string | null;
  work_area: string | null;
  looking_for_job: boolean;
  social_links: Record<string, string> | null;
  tech_tags: string[] | null;
};

function CandidatosPage() {
  const navigate = useNavigate();
  const { isAdmin, isRecruiter, rolesReady } = useDashboardRoles();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (rolesReady && !isAdmin && !isRecruiter) navigate({ to: "/dashboard" });
  }, [rolesReady, isAdmin, isRecruiter, navigate]);

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,display_name,email,bio,work_area,looking_for_job,social_links,tech_tags")
        .eq("looking_for_job", true)
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as Candidate[];
    },
  });

  const filtered = useMemo(() => {
    if (!search) return candidates;
    const q = search.toLowerCase();
    return candidates.filter(
      (c) =>
        c.display_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.work_area?.toLowerCase().includes(q) ||
        c.bio?.toLowerCase().includes(q) ||
        (c.tech_tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [candidates, search]);

  return (
    <DashboardShell title="Candidatos" description="Membros sinalizando que estão em busca de oportunidades.">
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, e-mail, área ou bio" className="pl-9" />
        </div>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} candidato(s)</div>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Carregando…</p>}

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((c) => (
          <div key={c.user_id} className="glass rounded-xl p-5 border border-primary/20">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-black text-background">
                  {c.display_name?.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-bold truncate">{c.display_name}</div>
                  {c.work_area && <div className="text-xs text-muted-foreground truncate">{c.work_area}</div>}
                </div>
              </div>
              <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">EM BUSCA</Badge>
            </div>
            {c.bio && <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{c.bio}</p>}

            {(c.tech_tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {c.tech_tags!.map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">{t}</span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
              <Button asChild size="sm">
                <a href={`mailto:${c.email}`}><Mail className="h-3 w-3 mr-1" /> Contatar</a>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link to="/dashboard/mensagens" search={{ to: c.user_id }}>
                  <MessageSquare className="h-3 w-3 mr-1" /> Mensagem
                </Link>
              </Button>
              {c.social_links &&
                Object.entries(c.social_links)
                  .filter(([, v]) => !!v)
                  .slice(0, 3)
                  .map(([k, v]) => (
                    <Button key={k} asChild size="sm" variant="outline">
                      <a href={v as string} target="_blank" rel="noreferrer">
                        {k} <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  ))}
            </div>
          </div>
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-2 text-center py-8">Nenhum candidato encontrado.</p>
        )}
      </div>
    </DashboardShell>
  );
}