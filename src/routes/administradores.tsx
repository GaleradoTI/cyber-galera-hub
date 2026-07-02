import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { PublicLayout } from "@/components/public/public-layout";
import { PublicMascotSpot } from "@/components/public/public-mascot-spot";
import { supabase } from "@/integrations/supabase/client";
import { CommunityProfileCard, type CommunityProfile } from "@/components/public/community-profile-card";
import { CommunityProfileSkeletonGrid } from "@/components/public/community-profile-skeleton";

export const Route = createFileRoute("/administradores")({
  head: () => ({
    meta: [
      { title: "Administradores — GALERA DO T.I." },
      { name: "description", content: "Conheça os administradores da GALERA DO T.I. e o que fazem pela comunidade." },
      { property: "og:title", content: "Administradores — GALERA DO T.I." },
      { property: "og:description", content: "Histórias e responsabilidades de quem cuida da comunidade." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://galera-do-ti.lovable.app/administradores" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Administradores — GALERA DO T.I." },
      { name: "twitter:description", content: "Histórias e responsabilidades de quem cuida da comunidade." },
    ],
    links: [{ rel: "canonical", href: "https://galera-do-ti.lovable.app/administradores" }],
  }),
  component: AdministradoresPage,
});

function AdministradoresPage() {
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["community-profiles", "administrator"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_profiles")
        .select("*")
        .eq("profile_type", "administrator")
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
            <div className="text-xs font-bold tracking-[0.3em] text-secondary mb-2">GESTÃO</div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">Administradores</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl">Quem mantém a comunidade organizada, segura e em movimento.</p>
          </div>
          <PublicMascotSpot placement="administrators" className="hidden lg:flex" />
        </div>
        {isLoading ? (
          <CommunityProfileSkeletonGrid />
        ) : profiles.length === 0 ? (
          <div className="glass rounded-xl p-8 mt-10 text-center text-muted-foreground"><ShieldCheck className="h-8 w-8 mx-auto mb-2" /> Nenhum administrador publicado ainda.</div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 mt-10">
            {profiles.map((p) => <CommunityProfileCard key={p.id} profile={p} />)}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}