import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Briefcase, Linkedin, Github, Globe, Instagram, Twitter, X, Tag, Phone, Plus, Youtube, MessageCircle, Trophy, CheckCircle2, Heart } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAZIL_STATES, GENDER_OPTIONS, getRegionByState } from "@/lib/profile-demographics";

export const Route = createFileRoute("/dashboard/perfil")({ component: PerfilPage });

const profileSchema = z.object({
  display_name: z.string().trim().min(2, "Nome muito curto").max(80),
  bio: z.string().trim().max(500).optional().nullable(),
  work_area: z.string().trim().max(80).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  gender: z.enum(["feminino", "masculino", "nao_binario", "outro", "prefiro_nao_informar"]).optional().nullable(),
  birth_date: z.string().trim().max(10).optional().nullable(),
  address_postal_code: z.string().trim().max(20).optional().nullable(),
  address_street: z.string().trim().max(160).optional().nullable(),
  address_number: z.string().trim().max(20).optional().nullable(),
  address_complement: z.string().trim().max(80).optional().nullable(),
  address_neighborhood: z.string().trim().max(100).optional().nullable(),
  address_city: z.string().trim().max(100).optional().nullable(),
  address_state: z.string().trim().regex(/^[A-Z]{2}$/).optional().nullable(),
  address_country: z.string().trim().max(80).optional().nullable(),
  address_region: z.string().trim().max(40).optional().nullable(),
  looking_for_job: z.boolean(),
  tech_tags: z.array(z.string().trim().min(1).max(40)).max(20),
  avatar_url: z.string().trim().max(500).optional().nullable(),
  social_links: z.record(
    z.string().trim().min(1).max(30).regex(/^[a-z0-9_-]+$/i, "Use apenas letras, números, _ ou -"),
    z.string().trim().max(300),
  ),
});

const PRESET_SOCIALS: { key: string; label: string; Icon: any; placeholder: string }[] = [
  { key: "linkedin", label: "LinkedIn", Icon: Linkedin, placeholder: "https://linkedin.com/in/..." },
  { key: "github", label: "GitHub", Icon: Github, placeholder: "https://github.com/..." },
  { key: "instagram", label: "Instagram", Icon: Instagram, placeholder: "https://instagram.com/..." },
  { key: "twitter", label: "Twitter / X", Icon: Twitter, placeholder: "https://x.com/..." },
  { key: "youtube", label: "YouTube", Icon: Youtube, placeholder: "https://youtube.com/@..." },
  { key: "discord", label: "Discord", Icon: MessageCircle, placeholder: "usuario#1234 ou convite" },
  { key: "website", label: "Site", Icon: Globe, placeholder: "https://..." },
];

function PerfilPage() {
  const qc = useQueryClient();
  const { user, rolesReady } = useDashboardRoles();
  const [form, setForm] = useState({
    display_name: "",
    bio: "",
    work_area: "",
    phone: "",
    gender: "" as string | null,
    birth_date: "" as string | null,
    address_postal_code: "",
    address_street: "",
    address_number: "",
    address_complement: "",
    address_neighborhood: "",
    address_city: "",
    address_state: "" as string | null,
    address_country: "Brasil",
    address_region: "",
    looking_for_job: false,
    tech_tags: [] as string[],
    avatar_url: "" as string | null,
    social_links: {} as Record<string, string>,
  });
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState({ next: "", confirm: "" });
  const [tagInput, setTagInput] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      gender: (profile as any).gender ?? "",
      birth_date: (profile as any).birth_date ?? "",
      address_postal_code: (profile as any).address_postal_code ?? "",
      address_street: (profile as any).address_street ?? "",
      address_number: (profile as any).address_number ?? "",
      address_complement: (profile as any).address_complement ?? "",
      address_neighborhood: (profile as any).address_neighborhood ?? "",
      address_city: (profile as any).address_city ?? "",
      address_state: (profile as any).address_state ?? "",
      address_country: (profile as any).address_country ?? "Brasil",
      address_region: (profile as any).address_region ?? "",
      looking_for_job: !!profile.looking_for_job,
      tech_tags: (profile.tech_tags ?? []) as string[],
      avatar_url: profile.avatar_url ?? "",
      social_links: { ...((profile.social_links ?? {}) as Record<string, string>) },
    });
  }, [profile]);

  const save = async () => {
    // remove entradas vazias antes de validar
    const cleanedSocial = Object.fromEntries(
      Object.entries(form.social_links).filter(([, v]) => v && v.trim().length > 0),
    );
    const parsed = profileSchema.safeParse({
      ...form,
      gender: form.gender || null,
      address_state: form.address_state || null,
      address_region: form.address_region || null,
      social_links: cleanedSocial,
    });
    if (!parsed.success) {
      const map: Record<string, string> = {};
      parsed.error.issues.forEach((iss) => {
        const k = iss.path.join(".") || "form";
        if (!map[k]) map[k] = iss.message;
      });
      setErrors(map);
      return toast.error("Revise os campos destacados", { description: parsed.error.issues[0].message });
    }
    setErrors({});
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.data.display_name,
        bio: parsed.data.bio ?? null,
        work_area: parsed.data.work_area ?? null,
        phone: parsed.data.phone ?? null,
        gender: parsed.data.gender || null,
        birth_date: parsed.data.birth_date || null,
        address_postal_code: parsed.data.address_postal_code ?? null,
        address_street: parsed.data.address_street ?? null,
        address_number: parsed.data.address_number ?? null,
        address_complement: parsed.data.address_complement ?? null,
        address_neighborhood: parsed.data.address_neighborhood ?? null,
        address_city: parsed.data.address_city ?? null,
        address_state: parsed.data.address_state || null,
        address_country: parsed.data.address_country || "Brasil",
        address_region: parsed.data.address_region || null,
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

  const addCustomSocial = () => {
    const key = customKey.trim().toLowerCase();
    if (!key) return toast.error("Informe um nome para a rede");
    if (!/^[a-z0-9_-]+$/.test(key)) return toast.error("Use apenas letras, números, _ ou -");
    if (form.social_links[key] !== undefined) return toast.error("Essa rede já existe");
    setForm({ ...form, social_links: { ...form.social_links, [key]: customUrl.trim() } });
    setCustomKey("");
    setCustomUrl("");
  };

  const removeSocial = (key: string) => {
    const next = { ...form.social_links };
    delete next[key];
    setForm({ ...form, social_links: next });
  };

  const presetKeys = new Set(PRESET_SOCIALS.map((p) => p.key));
  const customEntries = Object.entries(form.social_links).filter(([k]) => !presetKeys.has(k));

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
                policyKey="avatars"
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
              <div>
                <Label>Sexo / gênero</Label>
                <Select value={form.gender || "__empty"} onValueChange={(v) => setForm({ ...form, gender: v === "__empty" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__empty">Não informar</SelectItem>
                    {GENDER_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de nascimento</Label>
                <Input type="date" value={form.birth_date ?? ""} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
              </div>
              <div className="flex items-end gap-3 pb-1">
                <Switch checked={form.looking_for_job} onCheckedChange={(v) => setForm({ ...form, looking_for_job: v })} />
                <Label className="!mt-0">Estou em busca de oportunidade</Label>
              </div>
            </div>
          </section>

          <section className="glass rounded-xl p-5 border border-primary/20">
            <h2 className="font-bold text-sm mb-4">Endereço</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>CEP</Label>
                <Input value={form.address_postal_code} onChange={(e) => setForm({ ...form, address_postal_code: e.target.value })} placeholder="00000-000" maxLength={20} />
              </div>
              <div>
                <Label>País</Label>
                <Input value={form.address_country} onChange={(e) => setForm({ ...form, address_country: e.target.value })} placeholder="Brasil" maxLength={80} />
              </div>
              <div className="sm:col-span-2">
                <Label>Rua / logradouro</Label>
                <Input value={form.address_street} onChange={(e) => setForm({ ...form, address_street: e.target.value })} maxLength={160} />
              </div>
              <div>
                <Label>Número</Label>
                <Input value={form.address_number} onChange={(e) => setForm({ ...form, address_number: e.target.value })} maxLength={20} />
              </div>
              <div>
                <Label>Complemento</Label>
                <Input value={form.address_complement} onChange={(e) => setForm({ ...form, address_complement: e.target.value })} maxLength={80} />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input value={form.address_neighborhood} onChange={(e) => setForm({ ...form, address_neighborhood: e.target.value })} maxLength={100} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={form.address_city} onChange={(e) => setForm({ ...form, address_city: e.target.value })} maxLength={100} />
              </div>
              <div>
                <Label>Estado</Label>
                <Select
                  value={form.address_state || "__empty"}
                  onValueChange={(v) => {
                    const uf = v === "__empty" ? "" : v;
                    setForm({ ...form, address_state: uf, address_region: getRegionByState(uf) });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__empty">Não informar</SelectItem>
                    {BRAZIL_STATES.map((item) => <SelectItem key={item.uf} value={item.uf}>{item.uf} — {item.state}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Região</Label>
                <Input value={form.address_region} readOnly placeholder="Preenchida pelo estado" />
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
              {PRESET_SOCIALS.map(({ key, label, Icon, placeholder }) => (
                <div key={key}>
                  <Label className="flex items-center gap-2"><Icon className="h-3 w-3" /> {label}</Label>
                  <Input
                    value={form.social_links[key] ?? ""}
                    onChange={(e) => setForm({ ...form, social_links: { ...form.social_links, [key]: e.target.value } })}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>

            {customEntries.length > 0 && (
              <>
                <div className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground/70 mt-5 mb-2">REDES PERSONALIZADAS</div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {customEntries.map(([k, v]) => (
                    <div key={k}>
                      <Label className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 truncate"><Globe className="h-3 w-3" /> {k}</span>
                        <button type="button" onClick={() => removeSocial(k)} className="text-destructive text-xs">
                          <X className="h-3 w-3" />
                        </button>
                      </Label>
                      <Input
                        value={v}
                        onChange={(e) => setForm({ ...form, social_links: { ...form.social_links, [k]: e.target.value } })}
                        placeholder="https://"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="mt-5 pt-4 border-t border-border/40">
              <div className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground/70 mb-2">ADICIONAR REDE PERSONALIZADA</div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input className="sm:w-40" placeholder="ex: tiktok" value={customKey} onChange={(e) => setCustomKey(e.target.value)} maxLength={30} />
                <Input className="flex-1" placeholder="URL ou handle" value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} maxLength={300} />
                <Button type="button" variant="outline" onClick={addCustomSocial}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando…" : "Salvar perfil"}
            </Button>
          </div>

          <ParticipationCard userId={user!.id} />

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

function ParticipationCard({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["my-participation", userId],
    queryFn: async () => {
      const [ci, it] = await Promise.all([
        supabase.from("event_checkins").select("event_id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("user_event_interests").select("event_id", { count: "exact", head: true }).eq("user_id", userId),
      ]);
      return { checkins: ci.count ?? 0, interests: it.count ?? 0 };
    },
  });
  const checkins = data?.checkins ?? 0;
  const interests = data?.interests ?? 0;
  const tiers = [
    { n: 1, label: "Explorador", color: "bg-secondary/15 text-secondary border-secondary/30" },
    { n: 5, label: "Frequente", color: "bg-primary/15 text-primary border-primary/30" },
    { n: 10, label: "Engajado", color: "bg-accent/15 text-accent border-accent/30" },
    { n: 25, label: "Embaixador", color: "bg-destructive/15 text-destructive border-destructive/30" },
  ];
  const earned = tiers.filter((t) => checkins >= t.n);
  return (
    <section className="glass rounded-xl p-5 border border-primary/20">
      <h2 className="font-bold text-sm mb-4 flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Participação na comunidade</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <div className="glass rounded-lg p-3 border border-border/40">
          <div className="text-[10px] tracking-[0.2em] text-muted-foreground">CHECK-INS</div>
          <div className="text-2xl font-black text-gradient-neon flex items-center gap-1"><CheckCircle2 className="h-5 w-5" /> {checkins}</div>
        </div>
        <div className="glass rounded-lg p-3 border border-border/40">
          <div className="text-[10px] tracking-[0.2em] text-muted-foreground">INTERESSES</div>
          <div className="text-2xl font-black flex items-center gap-1"><Heart className="h-5 w-5 text-primary" /> {interests}</div>
        </div>
        <div className="glass rounded-lg p-3 border border-border/40">
          <div className="text-[10px] tracking-[0.2em] text-muted-foreground">CONVERSÃO</div>
          <div className="text-2xl font-black">{interests > 0 ? Math.round((checkins / interests) * 100) : 0}%</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tiers.map((t) => {
          const has = earned.includes(t);
          return (
            <span key={t.label} className={`text-xs px-2 py-1 rounded-full border ${has ? t.color : "bg-muted/40 text-muted-foreground border-border opacity-60"}`}>
              {t.label} <span className="opacity-70">({t.n}+)</span>
            </span>
          );
        })}
      </div>
    </section>
  );
}