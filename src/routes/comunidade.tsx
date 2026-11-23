import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Handshake, ShieldCheck, Sparkles } from "lucide-react";
import { PublicLayout } from "@/components/public/public-layout";
import { PublicMascotSpot } from "@/components/public/public-mascot-spot";
import { CommunityProfilesSection, PartnersSection } from "@/components/public/community-sections";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const ABAS = ["embaixadores", "administradores", "parceiros"] as const;
type Aba = (typeof ABAS)[number];

export const Route = createFileRoute("/comunidade")({
  validateSearch: (s: Record<string, unknown>): { aba?: Aba } => ({
    aba: (ABAS as readonly string[]).includes(s.aba as string) ? (s.aba as Aba) : "embaixadores",
  }),
  head: () => ({
    meta: [
      { title: "Comunidade — GALERA DO T.I." },
      { name: "description", content: "Embaixadores, administradores e parceiros da GALERA DO T.I. em um só lugar." },
      { property: "og:title", content: "Comunidade — GALERA DO T.I." },
      { property: "og:description", content: "Quem representa, cuida e caminha com a comunidade." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://galera-do-ti.lovable.app/comunidade" },
    ],
    links: [{ rel: "canonical", href: "https://galera-do-ti.lovable.app/comunidade" }],
  }),
  component: ComunidadePage,
});

const COPY: Record<Aba, { eyebrow: string; title: string; description: string; placement: string }> = {
  embaixadores: { eyebrow: "COMUNIDADE", title: "Embaixadores", description: "Pessoas que representam, acolhem e movimentam a GALERA DO T.I.", placement: "ambassadors" },
  administradores: { eyebrow: "GESTÃO", title: "Administradores", description: "Quem cuida da comunidade e mantém tudo de pé.", placement: "ambassadors" },
  parceiros: { eyebrow: "QUEM CAMINHA COM A GENTE", title: "Parceiros", description: "Empresas, escolas e iniciativas que acreditam na nossa comunidade. Clique para acessar a página oficial de cada um.", placement: "partners" },
};

function ComunidadePage() {
  const aba = Route.useSearch().aba ?? "embaixadores";
  const navigate = useNavigate({ from: "/comunidade" });
  const c = COPY[aba];

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-[1fr_260px] gap-8 items-center">
          <div>
            <div className="text-xs font-bold tracking-[0.3em] text-secondary mb-2">{c.eyebrow}</div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">{c.title}</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl">{c.description}</p>
          </div>
          <PublicMascotSpot placement={c.placement} className="hidden lg:flex" />
        </div>

        <Tabs value={aba} onValueChange={(v) => navigate({ search: { aba: v as Aba }, replace: true })} className="mt-8">
          <TabsList>
            <TabsTrigger value="embaixadores" className="gap-1.5"><Sparkles className="h-4 w-4" /> Embaixadores</TabsTrigger>
            <TabsTrigger value="administradores" className="gap-1.5"><ShieldCheck className="h-4 w-4" /> Administradores</TabsTrigger>
            <TabsTrigger value="parceiros" className="gap-1.5"><Handshake className="h-4 w-4" /> Parceiros</TabsTrigger>
          </TabsList>
          <TabsContent value="embaixadores" className="mt-6"><CommunityProfilesSection type="ambassador" /></TabsContent>
          <TabsContent value="administradores" className="mt-6"><CommunityProfilesSection type="administrator" /></TabsContent>
          <TabsContent value="parceiros" className="mt-6"><PartnersSection /></TabsContent>
        </Tabs>
      </section>
    </PublicLayout>
  );
}
