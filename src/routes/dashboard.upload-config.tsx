import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/dashboard/upload-config")({ component: UploadConfigPage });

type Ctx = { max_mb?: number; accept?: string[]; resize_max?: number };
type Policy = Record<string, Ctx>;

const CONTEXTS: { key: string; label: string; description: string }[] = [
  { key: "defaults", label: "Padrão (fallback)", description: "Usado quando um contexto específico não define o valor." },
  { key: "avatars", label: "Avatares", description: "Foto de perfil dos membros (bucket: avatars)." },
  { key: "project_covers", label: "Capas/Banners de projeto", description: "Capa e banner em /dashboard/projetos (bucket: project-covers)." },
  { key: "event_banners", label: "Banners de evento", description: "Capa de evento no admin e em sugerir-evento (bucket: project-covers/events)." },
  { key: "drop_images", label: "Imagens de Drop", description: "Galeria do drop em /dashboard/drops (bucket: project-covers/drops)." },
  { key: "favicon", label: "Favicon", description: "Ícone do site em Configurações." },
  { key: "documents", label: "Documentos (PDF/imagem)", description: "Para futuros uploads de documentos (currículos, materiais)." },
];

const COMMON_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/gif",
  "application/pdf",
];

function UploadConfigPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isSuperAdmin, rolesReady } = useDashboardRoles();
  useEffect(() => { if (rolesReady && !isSuperAdmin) navigate({ to: "/dashboard" }); }, [rolesReady, isSuperAdmin, navigate]);

  const { data: setting, isLoading } = useQuery({
    queryKey: ["upload-policy-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_site_settings")
        .select("*")
        .eq("setting_key", "upload_policy")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [draft, setDraft] = useState<Policy>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (setting?.setting_value) setDraft(setting.setting_value as Policy); }, [setting]);

  const updateCtx = (key: string, patch: Partial<Ctx>) =>
    setDraft((d) => ({ ...d, [key]: { ...(d[key] ?? {}), ...patch } }));

  const toggleType = (key: string, mime: string) => {
    const cur = draft[key]?.accept ?? [];
    updateCtx(key, { accept: cur.includes(mime) ? cur.filter((m) => m !== mime) : [...cur, mime] });
  };

  const save = async () => {
    if (!setting?.id) return;
    setSaving(true);
    const { error } = await supabase.from("public_site_settings").update({ setting_value: draft }).eq("id", setting.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Política de upload salva.");
    qc.invalidateQueries({ queryKey: ["upload-policy"] });
    qc.invalidateQueries({ queryKey: ["upload-policy-admin"] });
  };

  const reset = () => { if (setting?.setting_value) setDraft(setting.setting_value as Policy); };

  const totalSize = useMemo(() => Object.values(draft).reduce((s, c) => s + (c?.max_mb ?? 0), 0), [draft]);

  if (rolesReady && !isSuperAdmin) return null;

  return (
    <DashboardShell
      title="Configurações de Upload"
      description="Apenas SUPER_ADMIN. Define tipos de arquivo aceitos, tamanho máximo e redimensionamento por contexto."
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">
          Soma dos limites configurados: <strong>{totalSize} MB</strong>. Mudanças se aplicam imediatamente em toda a aplicação.
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="h-3 w-3 mr-1" /> Restaurar</Button>
          <Button size="sm" onClick={save} disabled={saving || isLoading}><Save className="h-3 w-3 mr-1" /> {saving ? "Salvando…" : "Salvar"}</Button>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Carregando…</p>}

      <div className="space-y-4">
        {CONTEXTS.map((ctx) => {
          const cur = draft[ctx.key] ?? {};
          return (
            <div key={ctx.key} className="glass rounded-xl p-4 border border-primary/20">
              <div className="mb-3">
                <h3 className="font-bold text-sm">{ctx.label}</h3>
                <p className="text-xs text-muted-foreground">{ctx.description}</p>
                <code className="text-[10px] text-muted-foreground/70">key: {ctx.key}</code>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Tamanho máximo (MB)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    value={cur.max_mb ?? ""}
                    onChange={(e) => updateCtx(ctx.key, { max_mb: e.target.value === "" ? undefined : Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Resize (px) — opcional</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="ex.: 1920"
                    value={cur.resize_max ?? ""}
                    onChange={(e) => updateCtx(ctx.key, { resize_max: e.target.value === "" ? undefined : Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="mt-3">
                <Label>Tipos aceitos</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {COMMON_TYPES.map((m) => {
                    const on = (cur.accept ?? []).includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleType(ctx.key, m)}
                        className={`text-[10px] px-2 py-1 rounded border ${on ? "bg-primary/20 border-primary/40 text-primary" : "bg-background/40 border-border/40 text-muted-foreground"}`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Selecionados: {(cur.accept ?? []).length === 0 ? "—" : (cur.accept ?? []).join(", ")}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground mt-6">
        💡 Cada upload no app envia esses limites + valida o tipo no cliente. Em paralelo, as policies RLS do bucket (Supabase Storage) também aplicam a regra — admin/super admin para drops, capa e banners.
      </p>
    </DashboardShell>
  );
}