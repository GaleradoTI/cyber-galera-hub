import { HelpCircle } from "lucide-react";
import { PageHero } from "@/components/brand/ui-kit";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PublicLayout } from "@/components/public/public-layout";
import { PublicMascotSpot } from "@/components/public/public-mascot-spot";
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
      <section className="container mx-auto px-4 py-16 max-w-5xl">
        <PageHero icon={HelpCircle} eyebrow="DÚVIDAS" title="FAQ" description="Perguntas frequentes sobre a comunidade." aside={<PublicMascotSpot placement="faq" className="hidden lg:flex" />} />

        <div className="mt-10 glass rounded-2xl p-2 max-w-3xl">
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