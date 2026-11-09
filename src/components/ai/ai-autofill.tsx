import { useState } from "react";
import { Sparkles, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

/** Caixa "cole o texto e a IA preenche". Só campos encontrados são aplicados. */
export function AiAutofill<T extends Record<string, unknown>>({
  kind,
  run,
  onFill,
}: {
  kind: "evento" | "vaga" | "notícia";
  run: (text: string) => Promise<T>;
  onFill: (values: Partial<T>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (text.trim().length < 20) return toast.error("Cole um texto com pelo menos 20 caracteres.");
    setBusy(true);
    try {
      const out = await run(text);
      const filled = Object.fromEntries(
        Object.entries(out).filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)),
      ) as Partial<T>;
      const n = Object.keys(filled).length;
      if (n === 0) return toast.error("Não encontrei informações no texto. Tente colar mais detalhes.");
      onFill(filled);
      toast.success(`${n} campo(s) preenchido(s). Revise antes de salvar.`);
      setOpen(false);
      setText("");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível preencher agora.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
      <Button variant="ghost" type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 text-left h-auto" aria-expanded={open}>
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold flex-1">Preencher com IA</span>
        <span className="text-xs text-muted-foreground hidden sm:inline">Cole o texto da {kind === "evento" ? "divulgação" : "vaga"}</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && (
        <div className="mt-3 space-y-2">
          <Textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={kind === "evento"
              ? "Cole aqui o post, e-mail ou mensagem do evento (data, horário, local, palestrantes, programação…)"
              : kind === "notícia" ? "Cole o texto, comunicado ou material da notícia…" : "Cole aqui a descrição da vaga (empresa, requisitos, stack, modalidade, link…)"}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">Só os campos encontrados serão preenchidos. Nada é salvo até você clicar em Salvar.</p>
            <Button type="button" size="sm" onClick={go} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Preencher
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
