import { Radio } from "lucide-react";
import { PageHero } from "@/components/brand/ui-kit";
import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/public/public-layout";
import { PublicMascotSpot } from "@/components/public/public-mascot-spot";
import { ChannelGrid } from "@/components/public/channel-grid";

export const Route = createFileRoute("/canais")({
  head: () => ({
    meta: [
      { title: "Canais — GALERA DO T.I." },
      { name: "description", content: "Conecte-se com a comunidade nos nossos canais oficiais." },
    ],
  }),
  component: CanaisPage,
});

function CanaisPage() {
  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-16">
        <PageHero icon={Radio} eyebrow="ONDE A GENTE TÁ" title="Canais oficiais" description="Escolha onde se conectar com a comunidade." aside={<PublicMascotSpot placement="channels" className="hidden lg:flex" />} />
        <div className="mt-10">
          <ChannelGrid />
        </div>
      </section>
    </PublicLayout>
  );
}