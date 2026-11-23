import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarkdownView } from "@/components/ui/markdown-editor";
import { supabase } from "@/integrations/supabase/client";
import { CommunityProfileCard, type CommunityProfile } from "@/components/public/community-profile-card";
import { CommunityProfileSkeletonGrid } from "@/components/public/community-profile-skeleton";

const PAGE_SIZE = 9;

/** Lista pública de perfis da comunidade (embaixadores ou administradores). */
export function CommunityProfilesSection({ type }: { type: "ambassador" | "administrator" }) {
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("__all");
  const [page, setPage] = useState(1);
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["community-profiles", type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_profiles")
        .select("*")
        .eq("profile_type", type)
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CommunityProfile[];
    },
  });
  const areas = useMemo(() => Array.from(new Set(profiles.map((p) => p.role_title).filter(Boolean) as string[])).sort(), [profiles]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((p) => {
      if (area !== "__all" && (p.role_title ?? "") !== area) return false;
      if (!q) return true;
      return `${p.name} ${p.role_title ?? ""}`.toLowerCase().includes(q);
    });
  }, [profiles, search, area]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div>
      {!isLoading && profiles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por nome ou cargo" className="pl-9" />
          </div>
          {areas.length > 0 && (
            <Select value={area} onValueChange={(v) => { setArea(v); setPage(1); }}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Área de atuação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas as áreas</SelectItem>
                {areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="text-xs text-muted-foreground ml-auto">{filtered.length} resultado(s)</div>
        </div>
      )}

      {isLoading ? (
        <CommunityProfileSkeletonGrid />
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-8 mt-6 text-center text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-2" /> Nenhum perfil publicado ainda.</div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 mt-6">
            {paginated.map((p) => <CommunityProfileCard key={p.id} profile={p} />)}
          </div>
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-6 text-xs text-muted-foreground">
              <span>Página {currentPage} de {totalPages}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
                <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Próxima</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Vitrine pública de parceiros. */
export function PartnersSection() {
  const [q, setQ] = useState("");
  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["public-partners"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("partners").select("*").eq("is_active", true)
        .order("display_order", { ascending: true }).order("name", { ascending: true });
      return data ?? [];
    },
  });

  const filtered = partners.filter((p: any) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return p.name?.toLowerCase().includes(t) || p.description?.toLowerCase().includes(t);
  });

  return (
    <div>
      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar parceiro..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground mt-2">{filtered.length} parceiro(s)</p>

      {isLoading ? (
        <p className="text-muted-foreground mt-10">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground mt-10">Nenhum parceiro encontrado.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
          {filtered.map((p: any) => {
            const card = (
              <div className="glass rounded-xl p-5 hover-glow-cyan h-full flex flex-col group">
                <div className="flex items-start gap-3">
                  {p.logo_url ? (
                    <img src={p.logo_url} alt={p.name} loading="lazy" className="h-14 w-14 rounded-lg object-cover border border-border/40" />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold">
                      {p.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base group-hover:text-gradient-neon transition truncate">{p.name}</h3>
                    {p.website_url && (
                      <p className="text-[10px] uppercase tracking-wider text-secondary mt-1 inline-flex items-center gap-1 truncate">
                        <ExternalLink className="h-3 w-3 shrink-0" /> Página oficial
                      </p>
                    )}
                  </div>
                </div>
                {p.description && (
                  <div className="mt-3 text-xs text-muted-foreground line-clamp-4">
                    <MarkdownView>{p.description}</MarkdownView>
                  </div>
                )}
              </div>
            );
            return p.website_url ? (
              <a key={p.id} href={p.website_url} target="_blank" rel="noopener noreferrer" className="block">{card}</a>
            ) : (
              <div key={p.id}>{card}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
