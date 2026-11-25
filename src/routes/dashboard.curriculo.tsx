import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAZIL_STATES, getRegionByState } from "@/lib/profile-demographics";
import { db, openResume, MISSING_FIELD_LABEL } from "@/lib/resume";

export const Route = createFileRoute("/dashboard/curriculo")({ component: CurriculoPage });

const MAX_RESUME = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

type Row = Record<string, string>;
type Form = {
  display_name: string; phone: string; work_area: string; address_city: string; address_state: string;
  tech_tags: string; looking_for_job: boolean; share_contact: boolean;
  headline: string; availability: string; preferred_modality: string; salary_expectation: string;
  education: Row[]; courses: Row[]; experiences: Row[]; languages: Row[];
};

type ListKey = "education" | "experiences" | "courses" | "languages";
const LISTS: { key: ListKey; title: string; fields: [string, string][] }[] = [
  { key: "education", title: "Formação", fields: [["course", "Curso *"], ["institution", "Instituição"], ["level", "Nível (técnico, graduação…)"], ["period", "Período / situação"]] },
  { key: "experiences", title: "Experiência", fields: [["role", "Cargo *"], ["company", "Empresa"], ["period", "Período"], ["description", "O que você fazia"]] },
  { key: "courses", title: "Cursos e certificações", fields: [["name", "Nome *"], ["provider", "Onde fez"], ["year", "Ano"], ["url", "Link do certificado"]] },
  { key: "languages", title: "Idiomas", fields: [["name", "Idioma *"], ["level", "Nível"]] },
];

function CurriculoPage() {
  const { user } = useDashboardRoles();
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data, error } = useQuery({
    queryKey: ["my-resume", user?.id],
    enabled: !!user?.id,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const [p, c] = await Promise.all([
        supabase.from("profiles").select("display_name,phone,work_area,address_city,address_state,tech_tags,looking_for_job").eq("user_id", user!.id).single(),
        db.from("candidate_profiles").select("*").eq("user_id", user!.id).maybeSingle(),
      ]);
      if (p.error) throw p.error;
      if (c.error) throw c.error;
      return { profile: p.data, resume: c.data as any };
    },
  });

  const { data: missing = [] } = useQuery({
    queryKey: ["my-missing-fields", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await db.rpc("my_missing_application_fields");
      if (error) throw error;
      return (data ?? []) as string[];
    },
  });

  // Preenche o formulário só uma vez, para o envio do arquivo não apagar o que está sendo digitado.
  useEffect(() => {
    if (!data || form) return;
    const { profile: p, resume: c } = data;
    setForm({
      display_name: p.display_name ?? "", phone: p.phone ?? "", work_area: p.work_area ?? "",
      address_city: p.address_city ?? "", address_state: p.address_state ?? "",
      tech_tags: (p.tech_tags ?? []).join(", "), looking_for_job: !!p.looking_for_job,
      share_contact: !!c?.share_contact, headline: c?.headline ?? "", availability: c?.availability ?? "",
      preferred_modality: c?.preferred_modality ?? "", salary_expectation: c?.salary_expectation ?? "",
      education: c?.education ?? [], courses: c?.courses ?? [], experiences: c?.experiences ?? [], languages: c?.languages ?? [],
    });
  }, [data, form]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-resume"] });
    qc.invalidateQueries({ queryKey: ["my-missing-fields"] });
    qc.invalidateQueries({ queryKey: ["my-profile"] });
  };

  const save = async () => {
    if (!form || !user) return;
    if (form.display_name.trim().length < 2) return toast.error("Informe seu nome.");
    setSaving(true);
    try {
      const tags = Array.from(new Set(form.tech_tags.split(",").map((t) => t.trim().slice(0, 40)).filter(Boolean))).slice(0, 20);
      const p = await supabase.from("profiles").update({
        display_name: form.display_name.trim(), phone: form.phone.trim() || null, work_area: form.work_area.trim() || null,
        address_city: form.address_city.trim() || null, address_state: form.address_state || null,
        address_region: getRegionByState(form.address_state) || null,
        tech_tags: tags, looking_for_job: form.looking_for_job,
      }).eq("user_id", user.id);
      if (p.error) throw p.error;
      const clean = (key: ListKey) => {
        const required = LISTS.find((l) => l.key === key)!.fields[0][0];
        return form[key].filter((r) => r[required]?.trim());
      };
      const c = await db.from("candidate_profiles").upsert({
        user_id: user.id, share_contact: form.share_contact,
        headline: form.headline.trim() || null, availability: form.availability.trim() || null,
        preferred_modality: form.preferred_modality.trim() || null, salary_expectation: form.salary_expectation.trim() || null,
        education: clean("education"), courses: clean("courses"), experiences: clean("experiences"), languages: clean("languages"),
      });
      if (c.error) throw c.error;
      toast.success("Currículo salvo");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file || !user) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!EXTENSIONS[ext]) return toast.error("Envie um arquivo PDF, DOC ou DOCX.");
    if (file.size > MAX_RESUME) return toast.error("O arquivo deve ter no máximo 5 MB.");
    setUploading(true);
    try {
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("resumes").upload(path, file, { contentType: EXTENSIONS[ext] });
      if (up.error) throw up.error;
      const previous = data?.resume?.resume_path as string | undefined;
      const c = await db.from("candidate_profiles").upsert({ user_id: user.id, resume_path: path, resume_name: file.name.slice(0, 200) });
      if (c.error) throw c.error;
      if (previous) await supabase.storage.from("resumes").remove([previous]);
      toast.success("Currículo anexado");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no envio.");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = async () => {
    const path = data?.resume?.resume_path as string | undefined;
    if (!path || !user || !confirm("Remover o currículo anexado?")) return;
    const removed = await supabase.storage.from("resumes").remove([path]);
    if (removed.error) return toast.error(removed.error.message);
    const c = await db.from("candidate_profiles").update({ resume_path: null, resume_name: null }).eq("user_id", user.id);
    if (c.error) return toast.error(c.error.message);
    refresh();
  };

  const text = (key: keyof Form, label: string, placeholder = "") => (
    <div>
      <Label>{label}</Label>
      <Input value={form![key] as string} placeholder={placeholder} maxLength={160} onChange={(e) => setForm({ ...form!, [key]: e.target.value })} />
    </div>
  );
  const setList = (key: ListKey, rows: Row[]) => setForm({ ...form!, [key]: rows });
  const resumePath = data?.resume?.resume_path as string | undefined;

  return (
    <DashboardShell title="Meu Currículo" description="Essas informações são enviadas ao recrutador quando você se candidata a uma vaga interna.">
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {!form && !error && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {form && (
        <div className="grid gap-5 max-w-3xl">
          {missing.length > 0 && (
            <div className="rounded-xl border border-secondary/40 bg-secondary/10 p-4 text-sm">
              <p className="font-bold">Para se candidatar, ainda falta (salve depois de preencher):</p>
              <ul className="list-disc pl-5 mt-1">{missing.map((m) => <li key={m}>{MISSING_FIELD_LABEL[m] ?? m}</li>)}</ul>
            </div>
          )}

          <section className="glass rounded-xl p-5 border border-primary/20 space-y-3">
            <h2 className="font-bold text-sm">Importar currículo</h2>
            <p className="text-xs text-muted-foreground">PDF, DOC ou DOCX até 5 MB. Com o arquivo anexado, formação e conhecimentos ficam opcionais.</p>
            {resumePath && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Button size="sm" variant="outline" onClick={() => openResume(resumePath).catch((e) => toast.error(e.message))}>
                  <FileText className="h-4 w-4 mr-1" /> {data?.resume?.resume_name ?? "Currículo"}
                </Button>
                <Button size="sm" variant="ghost" onClick={removeFile} aria-label="Remover currículo"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            )}
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer text-primary">
              <Upload className="h-4 w-4" /> {uploading ? "Enviando…" : resumePath ? "Substituir arquivo" : "Anexar arquivo"}
              <input type="file" accept=".pdf,.doc,.docx" className="sr-only" disabled={uploading}
                onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </section>

          <section className="glass rounded-xl p-5 border border-primary/20">
            <h2 className="font-bold text-sm mb-4">Dados principais</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {text("display_name", "Nome *")}
              {text("phone", "Telefone / WhatsApp *", "(11) 99999-9999")}
              {text("work_area", "Área de atuação *", "Ex.: Front-end, Dados")}
              {text("headline", "Título profissional", "Ex.: Dev React júnior")}
              {text("address_city", "Cidade *")}
              <div>
                <Label>Estado *</Label>
                <Select value={form.address_state || undefined} onValueChange={(v) => setForm({ ...form, address_state: v })}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>{BRAZIL_STATES.map((s) => <SelectItem key={s.uf} value={s.uf}>{s.uf} — {s.state}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {text("availability", "Disponibilidade", "Ex.: imediata")}
              {text("preferred_modality", "Modalidade preferida", "Remoto, híbrido ou presencial")}
              {text("salary_expectation", "Pretensão salarial (opcional)")}
              <div className="sm:col-span-2">
                <Label>Conhecimentos (separados por vírgula)</Label>
                <Textarea rows={2} value={form.tech_tags} placeholder="React, SQL, Git" onChange={(e) => setForm({ ...form, tech_tags: e.target.value })} />
              </div>
            </div>
          </section>

          {LISTS.map((list) => (
            <section key={list.key} className="glass rounded-xl p-5 border border-primary/20 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold text-sm">{list.title}</h2>
                <Button size="sm" variant="outline" disabled={form[list.key].length >= 20} onClick={() => setList(list.key, [...form[list.key], {}])}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
              {form[list.key].map((row, i) => (
                <div key={i} className="rounded-lg border border-border/40 p-3 grid sm:grid-cols-2 gap-2 relative pr-10">
                  {list.fields.map(([field, label]) => (
                    <Input key={field} aria-label={label} placeholder={label} maxLength={field === "description" ? 800 : 200} value={row[field] ?? ""}
                      className={field === "description" ? "sm:col-span-2" : ""}
                      onChange={(e) => setList(list.key, form[list.key].map((r, n) => (n === i ? { ...r, [field]: e.target.value } : r)))} />
                  ))}
                  <Button size="icon" variant="ghost" className="absolute right-1 top-2 h-7 w-7" aria-label="Remover item"
                    onClick={() => setList(list.key, form[list.key].filter((_, n) => n !== i))}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </section>
          ))}

          <section className="glass rounded-xl p-5 border border-primary/20 space-y-3 text-sm">
            <label className="flex items-center gap-3"><Switch checked={form.looking_for_job} onCheckedChange={(v) => setForm({ ...form, looking_for_job: v })} /> Estou em busca de oportunidade (apareço no banco de talentos)</label>
            <label className="flex items-center gap-3"><Switch checked={form.share_contact} onCheckedChange={(v) => setForm({ ...form, share_contact: v })} /> No banco de talentos, liberar e-mail, telefone e currículo para recrutadores</label>
            <p className="text-xs text-muted-foreground">Ao se candidatar, o recrutador daquela vaga sempre recebe seu contato e currículo.</p>
          </section>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-2" /> {saving ? "Salvando…" : "Salvar currículo"}</Button>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
