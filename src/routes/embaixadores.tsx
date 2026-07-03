import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PublicLayout } from "@/components/public/public-layout";
import { PublicMascotSpot } from "@/components/public/public-mascot-spot";
import { supabase } from "@/integrations/supabase/client";
import { CommunityProfileCard, type CommunityProfile } from "@/components/public/community-profile-card";
import { CommunityProfileSkeletonGrid } from "@/components/public/community-profile-skeleton";

export const Route = createFileRoute("/embaixadores")({
  head: () => ({
    meta: [
      { title: "Embaixadores — GALERA DO T.I." },
      { name: "description", content: "Conheça os embaixadores da GALERA DO T.I., suas histórias e atuação na comunidade." },
      { property: "og:title", content: "Embaixadores — GALERA DO T.I." },
      { property: "og:description", content: "Pessoas que ajudam a movimentar a comunidade tech." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://galera-do-ti.lovable.app/embaixadores" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Embaixadores — GALERA DO T.I." },
      { name: "twitter:description", content: "Pessoas que ajudam a movimentar a comunidade tech." },
    ],
    links: [{ rel: "canonical", href: "https://galera-do-ti.lovable.app/embaixadores" }],
  }),
  component: () => <CommunityProfilesPage type="ambassador" title="Embaixadores" eyebrow="COMUNIDADE" description="Pessoas que representam, acolhem e movimentam a GALERA DO T.I." />,
});

function CommunityProfilesPage({ type, title, eyebrow, description }: { type: string; title: string; eyebrow: string; description: string }) {
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("__all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 9;
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["community-profiles", type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_profiles")
        .select("*")
        .eq("profile_type", type)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
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
    <PublicLayout>
      <section className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-[1fr_260px] gap-8 items-center">
          <div>
            <div className="text-xs font-bold tracking-[0.3em] text-secondary mb-2">{eyebrow}</div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">{title}</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl">{description}</p>
          </div>
          <PublicMascotSpot placement="ambassadors" className="hidden lg:flex" />
        </div>

        {!isLoading && profiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-8">
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
          <div className="glass rounded-xl p-8 mt-10 text-center text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-2" /> Nenhum perfil publicado ainda.</div>
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
      </section>
    </PublicLayout>
  );
}