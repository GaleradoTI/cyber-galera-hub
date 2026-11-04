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
function parseJsonLoose(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("A IA não conseguiu entender o texto. Tente colar mais detalhes.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

const ExtractInput = z.object({ text: z.string().trim().min(20, "Cole um texto com pelo menos 20 caracteres.").max(15000) });

const str = (v: unknown, max = 500) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const oneOf = <T extends string>(v: unknown, opts: readonly T[]) => (typeof v === "string" && (opts as readonly string[]).includes(v) ? (v as T) : undefined);
const timeStr = (v: unknown) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : undefined);
const dateStr = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const urlStr = (v: unknown) => (typeof v === "string" && /^https?:\/\//i.test(v.trim()) ? v.trim().slice(0, 500) : undefined);

export const extractEventFromText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ExtractInput.parse(d))
  .handler(async ({ data }) => {
    const today = new Date().toISOString().slice(0, 10);
    const sys = `Você extrai dados de eventos de tecnologia a partir de textos livres em pt-BR. Hoje é ${today}. Responda APENAS um JSON com as chaves:
name, theme, description (markdown organizado: resumo, para quem é, o que vai rolar), category (Workshop|Palestra|Meetup|Hackathon|Live|Outro), event_date (YYYY-MM-DD), event_time (HH:MM), end_time (HH:MM), modality (online|presencial|hibrido), address (endereço físico completo), online_link (link de transmissão), location_or_link (página oficial/inscrição), max_attendees (número), speakers ([{name, topic}]), schedule ([{time: "HH:MM", title, speaker?}]).
Use null quando não houver a informação. Nunca invente datas, links ou endereços.`;
    const raw = await callGateway(sys, data.text);
    const j = parseJsonLoose(raw);
    const speakers = Array.isArray(j.speakers)
      ? (j.speakers as any[]).map((s) => ({ name: str(s?.name, 120), topic: str(s?.topic, 200) })).filter((s) => s.name).slice(0, 12)
      : undefined;
    const schedule = Array.isArray(j.schedule)
      ? (j.schedule as any[]).map((s) => ({ time: timeStr(s?.time) ?? "", title: str(s?.title, 200) ?? "", speaker: str(s?.speaker, 120) ?? "" })).filter((s) => s.title).slice(0, 30)
      : undefined;
    const max = typeof j.max_attendees === "number" && j.max_attendees > 0 ? Math.round(j.max_attendees) : undefined;
    return {
      name: str(j.name, 200), theme: str(j.theme, 200), description: str(j.description, 8000),
      category: str(j.category, 60), event_date: dateStr(j.event_date), event_time: timeStr(j.event_time),
      end_time: timeStr(j.end_time), modality: oneOf(j.modality, ["online", "presencial", "hibrido"] as const),
      address: str(j.address, 300), online_link: urlStr(j.online_link), location_or_link: urlStr(j.location_or_link),
      max_attendees: max, speakers, schedule,
    };
  });

export const extractJobFromText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ExtractInput.parse(d))
  .handler(async ({ data }) => {
    const sys = `Você extrai dados de vagas de tecnologia a partir de textos livres em pt-BR. Responda APENAS um JSON com as chaves:
title, company, location, seniority (estagio|junior|pleno|senior|especialista), modality (remoto|hibrido|presencial), apply_url (link ou mailto), technologies (array de até 15 strings curtas), short_description (1-2 frases), description (markdown com seções: Sobre a vaga, Responsabilidades, Requisitos, Diferenciais, Benefícios — só com o que estiver no texto).
Use null quando não houver a informação. Nunca invente empresa, links ou salários.`;
    const raw = await callGateway(sys, data.text);
    const j = parseJsonLoose(raw);
    const apply = typeof j.apply_url === "string" && /^(https?:\/\/|mailto:)/i.test(j.apply_url.trim()) ? j.apply_url.trim().slice(0, 500) : undefined;
    return {
      title: str(j.title, 150), company: str(j.company, 150), location: str(j.location, 150),
      seniority: oneOf(j.seniority, ["estagio", "junior", "pleno", "senior", "especialista"] as const),
      modality: oneOf(j.modality, ["remoto", "hibrido", "presencial"] as const),
      apply_url: apply,
      technologies: Array.isArray(j.technologies) ? (j.technologies as unknown[]).map((t) => str(t, 40)).filter((t): t is string => !!t).slice(0, 15) : undefined,
      short_description: str(j.short_description, 400), description: str(j.description, 8000),
    };
  });
