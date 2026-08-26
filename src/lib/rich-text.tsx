import type { ReactNode } from "react";

export type RichLink = { url: string; label?: string };

const URL_RE = /https?:\/\/[^\s<>()]+/g;

/** Extrai até `max` URLs de um texto livre, removendo pontuação final. */
export function extractLinks(text: string, max = 8): RichLink[] {
  const found = (text.match(URL_RE) ?? []).map((url) => url.replace(/[),.;!?]+$/, ""));
  return Array.from(new Set(found))
    .slice(0, max)
    .map((url) => ({ url }));
}

/** Converte um textarea "Rótulo | https://..." (uma por linha) em links. */
export function parseLinkLines(value: string, max = 8): RichLink[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [a, b] = line.split("|").map((s) => s.trim());
      if (b) return { url: b, label: a };
      return { url: a };
    })
    .filter((l) => /^https?:\/\//.test(l.url))
    .slice(0, max);
}

export function linksToLines(links: RichLink[] | null | undefined) {
  return (links ?? []).map((l) => (l.label ? `${l.label} | ${l.url}` : l.url)).join("\n");
}

/** Junta links manuais com os detectados no texto, sem duplicar URLs. */
export function mergeLinks(manual: RichLink[], fromText: RichLink[], max = 8): RichLink[] {
  const seen = new Set<string>();
  const out: RichLink[] = [];
  for (const l of [...manual, ...fromText]) {
    if (!l?.url || seen.has(l.url)) continue;
    seen.add(l.url);
    out.push(l);
    if (out.length >= max) break;
  }
  return out;
}

export function prettyUrl(url: string, max = 46) {
  const clean = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/**
 * Renderiza texto preservando parágrafos e transformando URLs em links clicáveis.
 * Também dá destaque a linhas iniciadas por "- " (bullets).
 */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);

  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const isList = lines.every((l) => l.trim().startsWith("- ") || !l.trim());
        if (isList && lines.some((l) => l.trim())) {
          return (
            <ul key={bi} className="list-disc pl-5 space-y-1">
              {lines
                .filter((l) => l.trim())
                .map((l, li) => (
                  <li key={li}>{linkify(l.trim().replace(/^-\s+/, ""))}</li>
                ))}
            </ul>
          );
        }
        return (
          <p key={bi} className="whitespace-pre-wrap leading-relaxed">
            {lines.map((l, li) => (
              <span key={li}>
                {linkify(l)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function linkify(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of line.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const trimmed = raw.replace(/[),.;!?]+$/, "");
    if (start > last) out.push(line.slice(last, start));
    out.push(
      <a
        key={`${start}-${trimmed}`}
        href={trimmed}
        target="_blank"
        rel="noreferrer"
        className="text-primary underline underline-offset-2 hover:text-primary/80 break-all"
      >
        {prettyUrl(trimmed)}
      </a>,
    );
    if (raw.length > trimmed.length) out.push(raw.slice(trimmed.length));
    last = start + raw.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}
