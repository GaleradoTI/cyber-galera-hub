import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PublicLayout } from "@/components/public/public-layout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — GALERA DO T.I." },
      { name: "description", content: "Perguntas frequentes sobre a comunidade GALERA DO T.I." },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  const { data: faqs = [] } = useQuery({
    queryKey: ["faqs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("faqs")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      return data ?? [];
    },
  });

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-16 max-w-3xl">
        <div className="text-xs font-bold tracking-[0.3em] text-secondary mb-2">DÚVIDAS</div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">FAQ</h1>
        <p className="text-muted-foreground mt-2">Perguntas frequentes sobre a comunidade.</p>

        <div className="mt-10 glass rounded-2xl p-2">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f: any) => (
              <AccordionItem key={f.id} value={f.id} className="px-4">
                <AccordionTrigger className="text-left font-semibold">{f.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </PublicLayout>
  );
}