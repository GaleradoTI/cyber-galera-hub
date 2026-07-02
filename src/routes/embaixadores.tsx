import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
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

        {isLoading ? (
          <CommunityProfileSkeletonGrid />
        ) : profiles.length === 0 ? (
          <div className="glass rounded-xl p-8 mt-10 text-center text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-2" /> Nenhum perfil publicado ainda.</div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 mt-10">
            {profiles.map((p) => <CommunityProfileCard key={p.id} profile={p} />)}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}