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
        <div className="grid lg:grid-cols-[1fr_220px] gap-8 items-center">
          <div>
            <div className="text-xs font-bold tracking-[0.3em] text-secondary mb-2">ONDE A GENTE TÁ</div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">Canais oficiais</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">Escolha onde se conectar com a comunidade.</p>
          </div>
          <PublicMascotSpot placement="channels" className="hidden lg:flex" />
        </div>
        <div className="mt-10">
          <ChannelGrid />
        </div>
      </section>
    </PublicLayout>
  );
}