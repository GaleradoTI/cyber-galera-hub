import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Users } from "lucide-react";
import { PublicLayout } from "@/components/public/public-layout";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/embaixadores")({
  head: () => ({
    meta: [
      { title: "Embaixadores — GALERA DO T.I." },
      { name: "description", content: "Conheça os embaixadores da GALERA DO T.I., suas histórias e atuação na comunidade." },
      { property: "og:title", content: "Embaixadores — GALERA DO T.I." },
      { property: "og:description", content: "Pessoas que ajudam a movimentar a comunidade tech." },
    ],
  }),
  component: () => <CommunityProfilesPage type="ambassador" title="Embaixadores" eyebrow="COMUNIDADE" description="Pessoas que representam, acolhem e movimentam a GALERA DO T.I." />,
});

type Profile = {
  id: string;
  name: string;
  role_title: string | null;
  photo_url: string | null;
  professional_story: string | null;
  community_role: string | null;
  social_links: { label?: string; url?: string }[] | Record<string, string>;
};

function CommunityProfilesPage({ type, title, eyebrow, description }: { type: string; title: string; eyebrow: string; description: string }) {
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
      return (data ?? []) as Profile[];
    },
  });

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-16">
        <div className="text-xs font-bold tracking-[0.3em] text-secondary mb-2">{eyebrow}</div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl">{description}</p>

        {isLoading ? (
          <p className="text-muted-foreground mt-10">Carregando…</p>
        ) : profiles.length === 0 ? (
          <div className="glass rounded-xl p-8 mt-10 text-center text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-2" /> Nenhum perfil publicado ainda.</div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 mt-10">
            {profiles.map((p) => <ProfileCard key={p.id} profile={p} />)}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}

function normalizeLinks(value: Profile["social_links"]) {
  if (Array.isArray(value)) return value;
  return Object.entries(value ?? {}).map(([label, url]) => ({ label, url }));
}

function ProfileCard({ profile }: { profile: Profile }) {
  const links = normalizeLinks(profile.social_links).filter((l) => l.url);
  return (
    <article className="glass rounded-xl border border-primary/20 p-5 hover-glow-cyan">
      <div className="flex items-start gap-4">
        <Avatar className="h-20 w-20 border border-secondary/30">
          <AvatarImage src={profile.photo_url ?? undefined} alt={profile.name} className="object-cover" />
          <AvatarFallback>{profile.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h2 className="font-black text-xl leading-tight">{profile.name}</h2>
          {profile.role_title && <p className="text-sm text-secondary mt-1">{profile.role_title}</p>}
        </div>
      </div>
      {profile.professional_story && <p className="text-sm text-muted-foreground mt-4 whitespace-pre-wrap">{profile.professional_story}</p>}
      {profile.community_role && <div className="mt-4"><Badge variant="outline">{profile.community_role}</Badge></div>}
      {links.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {links.map((link) => (
            <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              {link.label || "Link"} <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      )}
    </article>
  );
}