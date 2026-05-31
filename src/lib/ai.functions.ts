import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

async function callGateway(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI indisponível: LOVABLE_API_KEY ausente.");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });
  if (res.status === 429) throw new Error("Limite de requisições atingido. Tente em alguns segundos.");
  if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI falhou (${res.status}): ${t.slice(0, 200)}`);
  }
  const json: any = await res.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

const JobInput = z.object({
  title: z.string().min(2).max(150),
  company: z.string().min(1).max(150),
  seniority: z.string().min(1).max(50),
  modality: z.string().min(1).max(50),
  technologies: z.array(z.string().min(1).max(50)).max(20).default([]),
});

export const generateJobDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => JobInput.parse(d))
  .handler(async ({ data }) => {
    const sys =
      "Você é um redator de vagas de tecnologia em pt-BR. Gere uma descrição clara, objetiva, sem exageros, com tom profissional e acolhedor. Estruture em seções curtas: Sobre a vaga, Responsabilidades, Requisitos, Diferenciais. Retorne apenas o texto markdown da descrição.";
    const user = `Crie a descrição para a vaga abaixo:
- Título: ${data.title}
- Empresa: ${data.company}
- Senioridade: ${data.seniority}
- Modalidade: ${data.modality}
- Stack: ${data.technologies.join(", ") || "não informada"}`;
    const text = await callGateway(sys, user);
    return { text };
  });

const TagsInput = z.object({
  bio: z.string().min(10).max(2000),
  work_area: z.string().max(150).optional().nullable(),
});

export const suggestTechTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TagsInput.parse(d))
  .handler(async ({ data }) => {
    const sys =
      "Você extrai tech tags de um texto livre em pt-BR. Retorne APENAS um JSON com a chave 'tags' contendo um array de no máximo 12 strings curtas (1-2 palavras cada), em minúsculo, sem duplicatas, focado em linguagens, frameworks, bancos, cloud e ferramentas. Sem texto adicional.";
    const user = `Área: ${data.work_area ?? "-"}\nBio: ${data.bio}`;
    const raw = await callGateway(sys, user);
    let tags: string[] = [];
    try {
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed?.tags)) {
        tags = parsed.tags
          .filter((t: unknown): t is string => typeof t === "string")
          .map((t: string) => t.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 12);
      }
    } catch {
      // Fallback: tenta extrair palavras
      tags = raw
        .split(/[\n,]/)
        .map((s) => s.replace(/[^a-zA-Z0-9+#./\-\s]/g, "").trim().toLowerCase())
        .filter((s) => s.length >= 2 && s.length <= 30)
        .slice(0, 12);
    }
    return { tags };
  });