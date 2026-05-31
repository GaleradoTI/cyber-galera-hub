/**
 * Calcula percentual de aderência entre as tech_tags do candidato
 * e as technologies exigidas por uma vaga.
 * Uso de intersecção / união (Jaccard) limitado a 100%.
 */
export function calcMatchPercent(candidateTags: string[] | null | undefined, jobTechs: string[] | null | undefined): number {
  const a = new Set((candidateTags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean));
  const b = new Set((jobTechs ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean));
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => { if (b.has(t)) inter++; });
  const union = a.size + b.size - inter;
  return Math.round((inter / union) * 100);
}

export function matchTone(pct: number): "high" | "mid" | "low" {
  if (pct >= 70) return "high";
  if (pct >= 40) return "mid";
  return "low";
}

export function matchClass(pct: number): string {
  const tone = matchTone(pct);
  if (tone === "high") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/40";
  if (tone === "mid") return "bg-yellow-500/15 text-yellow-400 border-yellow-500/40";
  return "bg-muted/30 text-muted-foreground border-border";
}