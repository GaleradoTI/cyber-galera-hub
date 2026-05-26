import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/configuracoes")({ component: SettingsPage });

type Setting = { id: string; setting_key: string; setting_value: any; description: string | null };

function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, rolesReady } = useDashboardRoles();

  useEffect(() => { if (rolesReady && !isAdmin) navigate({ to: "/dashboard" }); }, [rolesReady, isAdmin, navigate]);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("public_site_settings").select("*").order("setting_key");
      if (error) throw error;
      return (data ?? []) as Setting[];
    },
  });

  return (
    <DashboardShell title="Configurações do Site" description="Edite os textos públicos, hero, contatos e estatísticas.">
      {isLoading && <div className="text-muted-foreground">Carregando…</div>}
      <div className="grid gap-5">
        {settings.map((s) => (
          <SettingCard key={s.id} setting={s} onSaved={() => qc.invalidateQueries({ queryKey: ["site-settings"] })} />
        ))}
        {!isLoading && settings.length === 0 && (
          <div className="glass rounded-xl p-6 text-sm text-muted-foreground">
            Nenhuma configuração encontrada. Rode a migration de seed para criar as chaves padrão.
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function SettingCard({ setting, onSaved }: { setting: Setting; onSaved: () => void }) {
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
    <div className="glass rounded-xl p-5 border border-primary/20">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="text-xs font-bold tracking-[0.2em] text-primary">{setting.setting_key.toUpperCase()}</div>
          {setting.description && <p className="text-xs text-muted-foreground mt-1">{setting.description}</p>}
        </div>
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {keys.map((k) => {
          const v = draft[k];
          const isLong = typeof v === "string" && v.length > 60;
          const isObj = typeof v === "object" && v !== null;
          return (
            <div key={k} className={isObj || isLong ? "sm:col-span-2" : ""}>
              <Label className="text-xs text-muted-foreground">{k}</Label>
              {isObj ? (
                <Textarea
                  className="font-mono text-xs mt-1"
                  rows={6}
                  value={JSON.stringify(v, null, 2)}
                  onChange={(e) => {
                    try {
                      setDraft({ ...draft, [k]: JSON.parse(e.target.value) });
                    } catch {
                      /* ignore typing errors */
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
    </div>
  );
}