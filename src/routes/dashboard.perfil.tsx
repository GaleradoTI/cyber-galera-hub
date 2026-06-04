import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Briefcase, Linkedin, Github, Globe, Instagram, Twitter, X, Tag, Phone } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ImageUploader } from "@/components/ui/image-uploader";

export const Route = createFileRoute("/dashboard/perfil")({ component: PerfilPage });

const profileSchema = z.object({
  display_name: z.string().trim().min(2, "Nome muito curto").max(80),
  bio: z.string().trim().max(500).optional().nullable(),
  work_area: z.string().trim().max(80).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  looking_for_job: z.boolean(),
  tech_tags: z.array(z.string().trim().min(1).max(40)).max(20),
  avatar_url: z.string().trim().max(500).optional().nullable(),
  social_links: z.object({
    linkedin: z.string().trim().max(200).optional(),
    github: z.string().trim().max(200).optional(),
    instagram: z.string().trim().max(200).optional(),
    twitter: z.string().trim().max(200).optional(),
    website: z.string().trim().max(200).optional(),
  }),
});

function PerfilPage() {
  const qc = useQueryClient();
  const { user, rolesReady } = useDashboardRoles();
  const [form, setForm] = useState({
    display_name: "",
    bio: "",
    work_area: "",
    phone: "",
    looking_for_job: false,
    tech_tags: [] as string[],
    avatar_url: "" as string | null,
    social_links: { linkedin: "", github: "", instagram: "", twitter: "", website: "" } as Record<string, string>,
  });
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState({ next: "", confirm: "" });
  const [tagInput, setTagInput] = useState("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      display_name: profile.display_name ?? "",
      bio: profile.bio ?? "",
      work_area: profile.work_area ?? "",
      phone: (profile as any).phone ?? "",
      looking_for_job: !!profile.looking_for_job,
      tech_tags: (profile.tech_tags ?? []) as string[],
      avatar_url: profile.avatar_url ?? "",
      social_links: {
        linkedin: "", github: "", instagram: "", twitter: "", website: "",
        ...((profile.social_links ?? {}) as Record<string, string>),
      },
    });
  }, [profile]);

  const save = async () => {
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.data.display_name,
        bio: parsed.data.bio ?? null,
        work_area: parsed.data.work_area ?? null,
        phone: parsed.data.phone ?? null,
        looking_for_job: parsed.data.looking_for_job,
        tech_tags: parsed.data.tech_tags,
        avatar_url: parsed.data.avatar_url ?? null,
        social_links: parsed.data.social_links,
      })
      .eq("user_id", user!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
    qc.invalidateQueries({ queryKey: ["my-profile"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const updateEmail = async () => {
    const email = prompt("Novo e-mail:", user?.email ?? "");
    if (!email) return;
    const parsed = z.string().email().safeParse(email);
    if (!parsed.success) return toast.error("E-mail inválido");
    const { error } = await supabase.auth.updateUser({ email });
    if (error) return toast.error(error.message);
    toast.success("Confirme o novo e-mail na sua caixa de entrada");
  };

  const changePassword = async () => {
    if (pwd.next.length < 8) return toast.error("Senha deve ter pelo menos 8 caracteres");
    if (pwd.next !== pwd.confirm) return toast.error("Senhas não conferem");
    const { error } = await supabase.auth.updateUser({ password: pwd.next });
    if (error) return toast.error(error.message);
    toast.success("Senha alterada");
    setPwd({ next: "", confirm: "" });
  };

  return (
    <DashboardShell title="Meu Perfil" description="Atualize seus dados, links e disponibilidade.">
      {!user || !rolesReady || isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : (
        <div className="grid gap-5">
          <section className="glass rounded-xl p-5 border border-primary/20">
            <h2 className="font-bold text-sm mb-4">Dados básicos</h2>
            <div className="mb-5">
              <ImageUploader
                bucket="avatars"
                folder={user!.id}
                value={form.avatar_url}
                onChange={(url) => setForm({ ...form, avatar_url: url })}
                label="Foto de perfil"
                aspect="square"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Nome</Label>
                <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              </div>
              <div>
                <Label>E-mail</Label>
                <div className="flex gap-2">
                  <Input value={user?.email ?? ""} disabled />
                  <Button variant="outline" size="sm" onClick={updateEmail}>Alterar</Button>
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label>Bio</Label>
                <Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Fale um pouco sobre você (máx. 500 caracteres)" />
              </div>
              <div>
                <Label className="flex items-center gap-2"><Briefcase className="h-3 w-3" /> Área de atuação</Label>
                <Input value={form.work_area} onChange={(e) => setForm({ ...form, work_area: e.target.value })} placeholder="Ex.: Front-end, Dados, DevOps" />
              </div>
              <div>
                <Label className="flex items-center gap-2"><Phone className="h-3 w-3" /> Telefone / WhatsApp</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
              </div>
              <div className="flex items-end gap-3 pb-1">
                <Switch checked={form.looking_for_job} onCheckedChange={(v) => setForm({ ...form, looking_for_job: v })} />
                <Label className="!mt-0">Estou em busca de oportunidade</Label>
              </div>
            </div>
          </section>

          <section className="glass rounded-xl p-5 border border-primary/20">
            <h2 className="font-bold text-sm mb-4 flex items-center gap-2"><Tag className="h-3 w-3" /> Tecnologias</h2>
            <p className="text-xs text-muted-foreground mb-3">Adicione tags como React, Go, Python — recrutadores podem filtrar por elas.</p>
            <div className="flex gap-2">
              <Input
                placeholder="Digite e pressione Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const t = tagInput.trim();
                    if (t && !form.tech_tags.includes(t) && form.tech_tags.length < 20) {
                      setForm({ ...form, tech_tags: [...form.tech_tags, t] });
                    }
                    setTagInput("");
                  }
                }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {form.tech_tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-primary/15 text-primary border border-primary/30">
                  {t}
                  <button type="button" onClick={() => setForm({ ...form, tech_tags: form.tech_tags.filter((x) => x !== t) })}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {form.tech_tags.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma tag ainda.</p>}
            </div>
          </section>

          <section className="glass rounded-xl p-5 border border-primary/20">
            <h2 className="font-bold text-sm mb-4">Redes sociais</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {([
                ["linkedin", "LinkedIn", Linkedin],
                ["github", "GitHub", Github],
                ["instagram", "Instagram", Instagram],
                ["twitter", "Twitter / X", Twitter],
                ["website", "Site", Globe],
              ] as const).map(([k, label, Icon]) => (
                <div key={k}>
                  <Label className="flex items-center gap-2"><Icon className="h-3 w-3" /> {label}</Label>
                  <Input
                    value={form.social_links[k] ?? ""}
                    onChange={(e) => setForm({ ...form, social_links: { ...form.social_links, [k]: e.target.value } })}
                    placeholder="https://"
                  />
                </div>
              ))}
            </div>
          </section>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando…" : "Salvar perfil"}
            </Button>
          </div>

          <section className="glass rounded-xl p-5 border border-destructive/30">
            <h2 className="font-bold text-sm mb-4">Alterar senha</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Nova senha</Label>
                <Input type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
              </div>
              <div>
                <Label>Confirmar</Label>
                <Input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button variant="outline" onClick={changePassword}>Atualizar senha</Button>
            </div>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}