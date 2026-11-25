import { useState, type KeyboardEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Circle, FileText, Globe2, Rocket, Save, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { AiAutofill } from "@/components/ai/ai-autofill";
import { JobCard } from "@/components/public/job-card";
import { PublishPreview } from "@/components/dashboard/publish-preview";
import { extractJobFromText } from "@/lib/ai.functions";
import { MODALITY, SENIORITY, TYPE_META } from "@/lib/jobs";
import { cn } from "@/lib/utils";

export type JobDraft = {
  id?: string; title?: string; company?: string; description?: string; short_description?: string | null;
  seniority?: string; modality?: string; location?: string | null; apply_url?: string | null;
  technologies?: string[]; status?: string; application_type?: string;
};

const STEPS = ["Sobre a vaga", "Descrição e requisitos", "Revisar e publicar"];
const TEMPLATE = `## Sobre a vaga


## Responsabilidades
-

## Requisitos
-

## Diferenciais
-

## Benefícios
- `;
const SUGGESTED_TECH = ["React", "TypeScript", "Node.js", "Python", "Java", "SQL", "AWS", "Docker", "Git", "Figma"];
const validLink = (v?: string | null) => /^(https?:\/\/\S+|mailto:\S+)/i.test((v ?? "").trim());

type Props = {
  initial: JobDraft;
  /** null = quem publica pode escolher; senão o tipo é imposto pelo papel. */
  forcedType: "interna" | "externa" | null;
  isMemberOnly: boolean;
  canPublish: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: JobDraft) => void;
};

export function JobEditor({ initial, forcedType, isMemberOnly, canPublish, saving, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<JobDraft>(initial);
  const [step, setStep] = useState(0);
  const [tag, setTag] = useState("");
  const extractJob = useServerFn(extractJobFromText);
  const type = forcedType ?? draft.application_type ?? "interna";
  const tags = draft.technologies ?? [];
  const set = (patch: Partial<JobDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const addTags = (raw: string) => {
    const next = raw.split(",").map((t) => t.trim()).filter(Boolean)
      .filter((t) => !tags.some((x) => x.toLowerCase() === t.toLowerCase()));
    if (next.length) set({ technologies: [...tags, ...next].slice(0, 20) });
    setTag("");
  };
  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" && e.key !== ",") return;
    e.preventDefault();
    addTags(tag);
  };

  const problem = (s: number) => {
    if (s === 0) {
      if (!draft.title?.trim()) return "Informe o título da vaga.";
      if (!draft.company?.trim()) return "Informe a empresa.";
      if (type === "externa" && !validLink(draft.apply_url)) return "Informe o link da vaga externa (https://… ou mailto:).";
    }
    if (s === 1 && !draft.description?.trim()) return "Escreva a descrição da vaga.";
    return null;
  };

  const goTo = (target: number) => {
    for (let s = 0; s < target; s++) {
      const msg = problem(s);
      if (msg) { setStep(s); return toast.error(msg); }
    }
    setStep(target);
  };

  const submit = (status: string) => {
    const msg = problem(0) ?? problem(1);
    if (msg) return toast.error(msg);
    onSave({ ...draft, application_type: type, status });
  };

  const checklist = [
    { ok: !!draft.location?.trim() || draft.modality === "remoto", text: "Local informado" },
    { ok: tags.length >= 3, text: "Pelo menos 3 tecnologias ou conhecimentos" },
    { ok: !!draft.short_description?.trim(), text: "Resumo curto preenchido" },
    { ok: (draft.description?.trim().length ?? 0) >= 300, text: "Descrição com 300 caracteres ou mais" },
  ];
  const quality = checklist.filter((c) => c.ok).length;

  const choices = (label: string, options: typeof MODALITY, value: string | undefined, pick: (v: string) => void) => (
    <fieldset>
      <legend className="text-sm font-medium mb-1.5">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {Object.entries(options).map(([key, { label: text, icon: Icon }]) => (
          <button key={key} type="button" aria-pressed={value === key} onClick={() => pick(key)}
            className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition",
              value === key ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/50")}>
            <Icon className="h-4 w-4" /> {text}
          </button>
        ))}
      </div>
    </fieldset>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{draft.id ? "Editar vaga" : isMemberOnly ? "Indicar uma vaga" : "Publicar nova vaga"}</DialogTitle>
          <DialogDescription>Etapa {step + 1} de {STEPS.length}: {STEPS[step]}</DialogDescription>
        </DialogHeader>

        <ol className="grid grid-cols-3 gap-2">
          {STEPS.map((name, i) => (
            <li key={name}>
              <button type="button" onClick={() => goTo(i)} aria-current={i === step ? "step" : undefined} className="w-full text-left">
                <span className={cn("block h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
                <span className={cn("mt-1 flex items-center gap-1 text-[11px]", i === step ? "text-primary font-bold" : "text-muted-foreground")}>
                  {i < step && <Check className="h-3 w-3" />}<span className="truncate">{name}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="space-y-4">
            <AiAutofill kind="vaga" run={(text) => extractJob({ data: { text } })} onFill={(v) => set(v as JobDraft)} />
            {forcedType === null && (
              <div className="grid sm:grid-cols-2 gap-2">
                {(["interna", "externa"] as const).map((key) => {
                  const Icon = TYPE_META[key].icon;
                  return (
                    <button key={key} type="button" aria-pressed={type === key} onClick={() => set({ application_type: key })}
                      className={cn("rounded-xl border p-3 text-left transition", type === key ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")}>
                      <span className="flex items-center gap-2 font-bold text-sm"><Icon className="h-4 w-4 text-primary" /> {key === "interna" ? "Interna" : "Externa (terceiros)"}</span>
                      <span className="block text-xs text-muted-foreground mt-1">{key === "interna" ? "A pessoa se candidata aqui e você acompanha pelo painel." : "O botão leva para o site ou e-mail de outra empresa."}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><Label htmlFor="job-title">Título da vaga *</Label><Input id="job-title" maxLength={150} value={draft.title ?? ""} onChange={(e) => set({ title: e.target.value })} placeholder="Ex.: Desenvolvedor(a) Front-end React" /></div>
              <div><Label htmlFor="job-company">Empresa *</Label><Input id="job-company" maxLength={150} value={draft.company ?? ""} onChange={(e) => set({ company: e.target.value })} /></div>
              <div><Label htmlFor="job-location">Local</Label><Input id="job-location" maxLength={150} value={draft.location ?? ""} onChange={(e) => set({ location: e.target.value })} placeholder="Ex.: São Paulo/SP" /></div>
            </div>
            {choices("Modalidade", MODALITY, draft.modality, (v) => set({ modality: v }))}
            {choices("Senioridade", SENIORITY, draft.seniority, (v) => set({ seniority: v }))}
            {type === "externa" ? (
              <div><Label htmlFor="job-url" className="flex items-center gap-1"><Globe2 className="h-3.5 w-3.5" /> Link da vaga *</Label><Input id="job-url" value={draft.apply_url ?? ""} onChange={(e) => set({ apply_url: e.target.value })} placeholder="https://empresa.com/vaga" /></div>
            ) : (
              <p className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs text-muted-foreground">As candidaturas chegam em <strong>Candidatos</strong>, com perfil, contato e currículo.</p>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="job-tech">Tecnologias e conhecimentos</Label>
              <Input id="job-tech" value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={onTagKey} onBlur={() => addTags(tag)} placeholder="Digite e pressione Enter" />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/15 px-2.5 py-1 text-xs text-primary">
                      {t}<button type="button" aria-label={`Remover ${t}`} onClick={() => set({ technologies: tags.filter((x) => x !== t) })}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                {SUGGESTED_TECH.filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase())).slice(0, 8).map((s) => (
                  <button key={s} type="button" onClick={() => addTags(s)} className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary hover:text-primary">+ {s}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex justify-between"><Label htmlFor="job-summary">Resumo (aparece no topo da vaga)</Label><span className="text-[11px] text-muted-foreground">{(draft.short_description ?? "").length}/300</span></div>
              <Textarea id="job-summary" rows={2} maxLength={300} value={draft.short_description ?? ""} onChange={(e) => set({ short_description: e.target.value })} />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <Label>Descrição completa *</Label>
                {!draft.description?.trim() && <Button type="button" size="sm" variant="outline" onClick={() => set({ description: TEMPLATE })}><FileText className="h-3.5 w-3.5 mr-1" /> Usar modelo</Button>}
              </div>
              <MarkdownEditor value={draft.description ?? ""} onChange={(v) => set({ description: v })} rows={12} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Como vai aparecer</p>
              <div className="pointer-events-none">
                <JobCard job={{ ...draft, application_type: type, title: draft.title || "Título da vaga", company: draft.company || "Empresa", technologies: tags }} onClick={() => {}} />
              </div>
              <div className="mt-2"><PublishPreview kind="vaga" item={{ ...draft, application_type: type } as Record<string, any>} /></div>
            </div>
            <div className="glass rounded-xl border border-primary/20 p-4">
              <p className="font-bold text-sm">Qualidade do anúncio: {quality}/{checklist.length}</p>
              <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${(quality / checklist.length) * 100}%` }} /></div>
              <ul className="mt-3 space-y-2">
                {checklist.map((c) => (
                  <li key={c.text} className={cn("flex items-center gap-2 text-sm", !c.ok && "text-muted-foreground")}>
                    {c.ok ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4" />} {c.text}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground mt-3">São só sugestões: dá para publicar mesmo sem completar.</p>
              {isMemberOnly && <p className="text-xs text-secondary mt-2">A vaga aparece no site depois da aprovação da administração.</p>}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
          <Button type="button" variant="ghost" onClick={() => (step === 0 ? onClose() : setStep(step - 1))} disabled={saving}>
            {step === 0 ? "Cancelar" : <><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</>}
          </Button>
          <div className="flex flex-wrap gap-2">
            {/* Vaga já existente pode ser salva de qualquer etapa, mantendo a situação atual. */}
            {draft.id && !isMemberOnly && <Button type="button" variant="outline" onClick={() => submit(initial.status ?? "rascunho")} disabled={saving}><Save className="h-4 w-4 mr-1" /> Salvar alterações</Button>}
            {step < 2 ? (
              <Button type="button" onClick={() => goTo(step + 1)}>Continuar <ArrowRight className="h-4 w-4 ml-1" /></Button>
            ) : isMemberOnly ? (
              <Button type="button" onClick={() => submit("rascunho")} disabled={saving}><Send className="h-4 w-4 mr-1" /> {saving ? "Enviando…" : "Enviar para aprovação"}</Button>
            ) : (
              <>
                {!draft.id && <Button type="button" variant="outline" onClick={() => submit("rascunho")} disabled={saving}><Save className="h-4 w-4 mr-1" /> Salvar rascunho</Button>}
                {canPublish && initial.status !== "publicado" && <Button type="button" variant="neon" onClick={() => submit("publicado")} disabled={saving}><Rocket className="h-4 w-4 mr-1" /> {saving ? "Publicando…" : "Publicar vaga"}</Button>}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
