import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Search, Upload, Image as ImageIcon, Loader2, X, ExternalLink, Globe, Settings as SettingsIcon, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/configuracoes")({ component: SettingsPage });

type Setting = { id: string; setting_key: string; setting_value: any; description: string | null };

const FAVICON_FALLBACK = "/favicon.ico";
const FAVICON_MAX_BYTES = 512 * 1024;
const FAVICON_ALLOWED = ["image/png", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];

function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, rolesReady } = useDashboardRoles();

  useEffect(() => {
    if (rolesReady && !isAdmin) navigate({ to: "/dashboard" });
  }, [rolesReady, isAdmin, navigate]);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("public_site_settings").select("*").order("setting_key");
      if (error) throw error;
      return (data ?? []) as Setting[];
    },
  });

  const byKey = useMemo(() => Object.fromEntries(settings.map((s) => [s.setting_key, s])), [settings]);
  const onSaved = () => qc.invalidateQueries({ queryKey: ["site-settings"] });

  if (rolesReady && !isAdmin) return null;

  return (
    <DashboardShell title="Configurações do Site" description="Gerencie SEO, favicon, hero, contatos e demais textos públicos.">
      {isLoading && <div className="text-muted-foreground">Carregando…</div>}
      {!isLoading && (
        <Tabs defaultValue="seo" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/40 p-1">
            <TabsTrigger value="seo"><Search className="h-3.5 w-3.5 mr-1.5" /> SEO & Favicon</TabsTrigger>
            <TabsTrigger value="hero"><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Hero & Home</TabsTrigger>
            <TabsTrigger value="contato"><Globe className="h-3.5 w-3.5 mr-1.5" /> Contato & Social</TabsTrigger>
            <TabsTrigger value="avancado"><SettingsIcon className="h-3.5 w-3.5 mr-1.5" /> Avançado</TabsTrigger>
          </TabsList>

          <TabsContent value="seo" className="mt-5 space-y-5">
            {byKey.seo && <SeoCard setting={byKey.seo} onSaved={onSaved} />}
            {byKey.favicon && <FaviconCard setting={byKey.favicon} onSaved={onSaved} />}
          </TabsContent>

          <TabsContent value="hero" className="mt-5 space-y-5">
            {byKey.hero && <GenericCard setting={byKey.hero} onSaved={onSaved} title="Hero" />}
            {byKey.cta_section && <GenericCard setting={byKey.cta_section} onSaved={onSaved} title="CTA da home" />}
            {byKey.newsletter && <GenericCard setting={byKey.newsletter} onSaved={onSaved} title="Newsletter" />}
            {byKey.stats && <GenericCard setting={byKey.stats} onSaved={onSaved} title="Estatísticas" />}
            {byKey.about && <GenericCard setting={byKey.about} onSaved={onSaved} title="Sobre" />}
            {byKey.footer && <GenericCard setting={byKey.footer} onSaved={onSaved} title="Rodapé" />}
          </TabsContent>

          <TabsContent value="contato" className="mt-5 space-y-5">
            {byKey.contact && <GenericCard setting={byKey.contact} onSaved={onSaved} title="Contato" />}
            {byKey.social_links && <GenericCard setting={byKey.social_links} onSaved={onSaved} title="Redes sociais" />}
            {byKey.partners && <GenericCard setting={byKey.partners} onSaved={onSaved} title="Parceiros" />}
          </TabsContent>

          <TabsContent value="avancado" className="mt-5 space-y-5">
            {settings
              .filter((s) => !["seo", "favicon", "hero", "cta_section", "newsletter", "stats", "about", "footer", "contact", "social_links", "partners"].includes(s.setting_key))
              .map((s) => (
                <GenericCard key={s.id} setting={s} onSaved={onSaved} />
              ))}
          </TabsContent>
        </Tabs>
      )}
    </DashboardShell>
  );
}

function CardShell({
  title,
  description,
  badge,
  saving,
  onSave,
  children,
}: {
  title: string;
  description?: string | null;
  badge: string;
  saving: boolean;
  onSave: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-xl p-5 border border-primary/20">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="text-[10px] font-bold tracking-[0.25em] text-primary">{badge.toUpperCase()}</div>
          <h3 className="font-bold text-lg mt-0.5">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
        <Button size="sm" onClick={onSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
      {children}
    </div>
  );
}

/* ---------------------- SEO with live preview ---------------------- */
function SeoCard({ setting, onSaved }: { setting: Setting; onSaved: () => void }) {
  const [draft, setDraft] = useState<Record<string, any>>(setting.setting_value ?? {});
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("public_site_settings").update({ setting_value: draft }).eq("id", setting.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("SEO atualizado.");
    onSaved();
  };

  const siteUrl = (draft.site_url as string) || "https://galera-do-ti.lovable.app";

  return (
    <CardShell title="SEO Global" description="Title, description e Open Graph aplicados em todas as páginas." badge="SEO" saving={saving} onSave={save}>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          <Field label="Título padrão" hint={`${(draft.default_title ?? "").length}/60`}>
            <Input value={draft.default_title ?? ""} onChange={(e) => set("default_title", e.target.value)} maxLength={70} />
          </Field>
          <Field label="Descrição padrão" hint={`${(draft.default_description ?? "").length}/160`}>
            <Textarea rows={3} value={draft.default_description ?? ""} onChange={(e) => set("default_description", e.target.value)} maxLength={200} />
          </Field>
          <Field label="Keywords (separadas por vírgula)">
            <Input value={draft.keywords ?? ""} onChange={(e) => set("keywords", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Autor"><Input value={draft.author ?? ""} onChange={(e) => set("author", e.target.value)} /></Field>
            <Field label="Twitter (@handle)"><Input value={draft.twitter_site ?? ""} onChange={(e) => set("twitter_site", e.target.value)} /></Field>
          </div>
          <Field label="URL do site (canonical)">
            <Input placeholder="https://galera-do-ti.lovable.app" value={draft.site_url ?? ""} onChange={(e) => set("site_url", e.target.value)} />
          </Field>
          <Field label="Imagem Open Graph (URL)">
            <Input placeholder="https://..." value={draft.og_image ?? ""} onChange={(e) => set("og_image", e.target.value)} />
          </Field>
        </div>

        {/* live preview */}
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground mb-2">PRÉVIA GOOGLE</p>
            <div className="rounded-md border border-border/40 bg-background/50 p-4">
              <div className="text-xs text-emerald-400 truncate">{siteUrl}</div>
              <div className="text-base text-blue-400 hover:underline cursor-pointer truncate">
                {draft.default_title || "Título do site"}
              </div>
              <div className="text-sm text-muted-foreground line-clamp-2">
                {draft.default_description || "Descrição padrão aparecerá aqui."}
              </div>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground mb-2">PRÉVIA OPEN GRAPH</p>
            <div className="rounded-md border border-border/40 overflow-hidden bg-background/50">
              {draft.og_image ? (
                <img src={draft.og_image} alt="" className="w-full h-40 object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
              ) : (
                <div className="w-full h-40 bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                  <ImageIcon className="h-4 w-4 mr-1" /> sem og:image
                </div>
              )}
              <div className="p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{siteUrl.replace(/^https?:\/\//, "")}</div>
                <div className="font-bold text-sm truncate">{draft.default_title || "Título do site"}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{draft.default_description || "Descrição"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ---------------------- Favicon upload ---------------------- */
function FaviconCard({ setting, onSaved }: { setting: Setting; onSaved: () => void }) {
  const [draft, setDraft] = useState<Record<string, any>>(setting.setting_value ?? {});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const set = (k: string, v: any) => setDraft((d) => ({ ...d, [k]: v }));

  const handleFile = async (file: File) => {
    if (!FAVICON_ALLOWED.includes(file.type)) {
      toast.error("Formato inválido. Envie PNG, SVG ou ICO. Usando fallback.");
      set("url", FAVICON_FALLBACK);
      return;
    }
    if (file.size > FAVICON_MAX_BYTES) {
      toast.error("Arquivo maior que 512KB. Usando fallback.");
      set("url", FAVICON_FALLBACK);
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "ico";
    const path = `site/favicon-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("project-covers").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });
    setUploading(false);
    if (upErr) {
      toast.error(`Falha no upload: ${upErr.message}. Usando fallback.`);
      set("url", FAVICON_FALLBACK);
      return;
    }
    const { data } = supabase.storage.from("project-covers").getPublicUrl(path);
    set("url", data.publicUrl);
    toast.success("Favicon enviado.");
  };

  const save = async () => {
    const value = { ...draft, url: draft.url || FAVICON_FALLBACK };
    setSaving(true);
    const { error } = await supabase.from("public_site_settings").update({ setting_value: value }).eq("id", setting.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Favicon atualizado.");
    onSaved();
  };

  return (
    <CardShell title="Favicon" description="Aceita PNG, SVG ou ICO até 512KB. Se inválido, volta para o padrão." badge="ÍCONE" saving={saving} onSave={save}>
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-md border border-border/40 bg-muted/30 flex items-center justify-center overflow-hidden">
            {draft.url ? (
              <img src={draft.url} alt="favicon" className="w-12 h-12 object-contain" onError={(e) => ((e.target as HTMLImageElement).src = FAVICON_FALLBACK)} />
            ) : (
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            )}
            {uploading && <Loader2 className="h-4 w-4 animate-spin absolute" />}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".png,.svg,.ico,image/png,image/svg+xml,image/x-icon"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
              <Upload className="h-3 w-3 mr-1" /> Enviar favicon
            </Button>
            {draft.url && draft.url !== FAVICON_FALLBACK && (
              <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => set("url", FAVICON_FALLBACK)}>
                <X className="h-3 w-3 mr-1" /> Voltar ao padrão
              </Button>
            )}
            <p className="text-[10px] text-muted-foreground">PNG, SVG ou ICO • máx. 512KB</p>
          </div>
        </div>
        <div className="flex-1 min-w-[240px] space-y-3">
          <Field label="URL do favicon">
            <Input value={draft.url ?? ""} onChange={(e) => set("url", e.target.value)} placeholder={FAVICON_FALLBACK} />
          </Field>
          <Field label="URL apple-touch-icon (opcional)">
            <Input value={draft.apple_touch_url ?? ""} onChange={(e) => set("apple_touch_url", e.target.value)} placeholder="https://..." />
          </Field>
        </div>
      </div>
    </CardShell>
  );
}

/* ---------------------- Friendly field ---------------------- */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/* ---------------------- Generic card (existing flexible editor) ---------------------- */
function GenericCard({ setting, onSaved, title }: { setting: Setting; onSaved: () => void; title?: string }) {
  const value = setting.setting_value ?? {};
  const keys = Object.keys(value);
  const [draft, setDraft] = useState<Record<string, any>>(value);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("public_site_settings").update({ setting_value: draft }).eq("id", setting.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`"${setting.setting_key}" salvo.`);
    onSaved();
  };

  return (
    <CardShell
      title={title ?? setting.setting_key}
      description={setting.description}
      badge={setting.setting_key}
      saving={saving}
      onSave={save}
    >
      <div className="grid sm:grid-cols-2 gap-3">
        {keys.map((k) => {
          const v = draft[k];
          const isLong = typeof v === "string" && v.length > 60;
          const isObj = typeof v === "object" && v !== null;
          return (
            <div key={k} className={isObj || isLong ? "sm:col-span-2" : ""}>
              <Label className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</Label>
              {isObj ? (
                <Textarea
                  className="font-mono text-xs mt-1"
                  rows={6}
                  defaultValue={JSON.stringify(v, null, 2)}
                  onBlur={(e) => {
                    try {
                      setDraft({ ...draft, [k]: JSON.parse(e.target.value) });
                    } catch {
                      toast.error(`JSON inválido em "${k}"`);
                    }
                  }}
                />
              ) : isLong ? (
                <Textarea className="mt-1" rows={3} value={String(v ?? "")} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
              ) : (
                <Input className="mt-1" value={String(v ?? "")} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
              )}
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}