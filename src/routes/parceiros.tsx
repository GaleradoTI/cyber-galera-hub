import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ExternalLink, Handshake, Search } from "lucide-react";
import { PublicLayout } from "@/components/public/public-layout";
import { PublicMascotSpot } from "@/components/public/public-mascot-spot";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { MarkdownView } from "@/components/ui/markdown-editor";

export const Route = createFileRoute("/parceiros")({
  head: () => ({
    meta: [
      { title: "Parceiros — GALERA DO T.I." },
      { name: "description", content: "Empresas e iniciativas que apoiam a comunidade GALERA DO T.I." },
      { property: "og:title", content: "Parceiros — GALERA DO T.I." },
      { property: "og:description", content: "Conheça quem caminha com a gente." },
    ],
  }),
  component: ParceirosPublicPage,
});

function ParceirosPublicPage() {
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
    <PublicLayout>
      <section className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-[1fr_220px] gap-8 items-center">
          <div>
            <div className="text-xs font-bold tracking-[0.3em] text-secondary mb-2">QUEM CAMINHA COM A GENTE</div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight flex items-center gap-3">
              <Handshake className="h-9 w-9 text-primary" /> Parceiros
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Empresas, escolas e iniciativas que acreditam na nossa comunidade. Clique para acessar a página oficial de cada um.
            </p>
          </div>
          <PublicMascotSpot placement="partners" className="hidden lg:flex" />
        </div>

        <div className="mt-8 relative max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar parceiro..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">{filtered.length} parceiro(s)</p>

        {isLoading ? (
          <p className="text-muted-foreground mt-10">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground mt-10">Nenhum parceiro encontrado.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
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
      </section>
    </PublicLayout>
  );
}