import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Smartphone, CheckCheck, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { NotificationRow, type Notification } from "@/components/dashboard/notifications-bell";
import { useAuth } from "@/hooks/use-auth";
import { NOTIF_CATEGORIES, notificationCategory } from "@/lib/notification-meta";
import { enablePush, disablePush, pushEnabledHere, pushSupported } from "@/lib/pwa";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — GALERA DO T.I." },
      { name: "description", content: "Veja seus avisos e escolha o que receber no site e no celular." },
      { property: "og:title", content: "Notificações — GALERA DO T.I." },
      { property: "og:description", content: "Veja seus avisos e escolha o que receber no site e no celular." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificacoesPage,
});

type Prefs = { muted_categories: string[]; push_muted_categories: string[]; event_reminders: boolean };
const DEFAULT: Prefs = { muted_categories: [], push_muted_categories: [], event_reminders: true };

function NotificacoesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>("all");
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => { pushEnabledHere().then(setPushOn).catch(() => setPushOn(false)); }, []);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["notifications-all", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*").eq("user_id", user!.id)
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
  });

  const { data: prefs = DEFAULT } = useQuery({
    queryKey: ["notif-prefs", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("notification_preferences").select("muted_categories, push_muted_categories, event_reminders").eq("user_id", user!.id).maybeSingle();
      return (data as Prefs | null) ?? DEFAULT;
    },
  });

  const savePrefs = async (next: Prefs) => {
    qc.setQueryData(["notif-prefs", user?.id], next);
    const { error } = await supabase.from("notification_preferences").upsert({ user_id: user!.id, ...next });
    if (error) { toast.error(error.message); qc.invalidateQueries({ queryKey: ["notif-prefs"] }); }
  };
  const toggleIn = (arr: string[], k: string, on: boolean) => (on ? arr.filter((x) => x !== k) : [...new Set([...arr, k])]);

  const refresh = () => { qc.invalidateQueries({ queryKey: ["notifications"] }); qc.invalidateQueries({ queryKey: ["notifications-all"] }); };
  const open = async (n: Notification) => {
    if (!n.read_at) { await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id); refresh(); }
    if (n.link) navigate({ to: n.link });
  };
  const markAll = async () => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null).eq("user_id", user!.id);
    refresh();
  };
  const clearRead = async () => {
    const { error } = await supabase.from("notifications").delete().eq("user_id", user!.id).not("read_at", "is", null);
    if (error) return toast.error("Não foi possível limpar agora.");
    toast.success("Avisos lidos removidos"); refresh();
  };

  const togglePush = async (on: boolean) => {
    if (!user) return;
    setPushBusy(true);
    try {
      if (on) { await enablePush(user.id); toast.success("Avisos no celular ativados"); }
      else { await disablePush(); toast.success("Avisos no celular desativados neste aparelho"); }
      setPushOn(await pushEnabledHere());
    } catch (e: any) { toast.error(e?.message ?? "Não foi possível alterar."); }
    finally { setPushBusy(false); }
  };

  const unread = items.filter((n) => !n.read_at).length;
  const shown = filter === "all" ? items : filter === "unread" ? items.filter((n) => !n.read_at) : items.filter((n) => notificationCategory(n.type) === filter);

  return (
    <DashboardShell title="Notificações" description="Seus avisos e o que você quer receber.">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
        <section className="glass rounded-xl border border-border/40 overflow-hidden">
          <div className="p-3 border-b border-border/40 flex flex-wrap items-center gap-2">
            {[{ key: "all", label: "Todas" }, { key: "unread", label: `Não lidas${unread ? ` (${unread})` : ""}` }, ...NOTIF_CATEGORIES.map((c) => ({ key: c.key, label: c.label }))].map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={cn("px-3 py-1 rounded-full text-xs transition border", filter === f.key ? "bg-primary/15 text-primary border-primary/30 font-semibold" : "border-border/40 text-muted-foreground hover:bg-muted/40")}>
                {f.label}
              </button>
            ))}
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" onClick={markAll} disabled={!unread}><CheckCheck className="h-4 w-4 mr-1" /> Marcar lidas</Button>
              <Button size="sm" variant="ghost" onClick={clearRead}><Trash2 className="h-4 w-4 mr-1" /> Limpar lidas</Button>
            </div>
          </div>
          <div className="divide-y divide-border/30">
            {isLoading && Array.from({ length: 5 }).map((_, i) => <div key={i} className="p-3 flex gap-3"><Skeleton className="h-9 w-9 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/2" /></div></div>)}
            {!isLoading && shown.length === 0 && (
              <div className="p-10 text-center"><BellRing className="h-10 w-10 mx-auto text-muted-foreground/40" /><p className="mt-2 text-sm text-muted-foreground">Nenhum aviso aqui.</p></div>
            )}
            {shown.map((n) => <NotificationRow key={n.id} n={n} onClick={() => open(n)} />)}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="glass rounded-xl border border-border/40 p-4">
            <div className="flex items-start gap-3">
              <Smartphone className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-sm">Avisos no celular</div>
                <p className="text-xs text-muted-foreground">{pushSupported() ? "Receba os avisos mesmo com o app fechado." : "Este navegador não suporta avisos. No iPhone, adicione o app à tela inicial."}</p>
              </div>
              <Switch checked={pushOn} disabled={pushBusy || !pushSupported()} onCheckedChange={togglePush} aria-label="Avisos no celular" />
            </div>
          </div>

          <div className="glass rounded-xl border border-border/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-sm">Lembretes de evento</div>
                <p className="text-xs text-muted-foreground">Na véspera e no dia dos eventos em que você foi aprovado.</p>
              </div>
              <Switch checked={prefs.event_reminders} onCheckedChange={(v) => savePrefs({ ...prefs, event_reminders: v })} aria-label="Lembretes de evento" />
            </div>
          </div>

          <div className="glass rounded-xl border border-border/40 overflow-hidden">
            <div className="p-4 pb-2">
              <div className="font-semibold text-sm">O que receber</div>
              <p className="text-xs text-muted-foreground">Avisos importantes do sistema sempre chegam.</p>
            </div>
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 pb-1 text-[10px] font-bold tracking-wider text-muted-foreground">
              <span /> <span>SITE</span> <span>CELULAR</span>
            </div>
            <div className="divide-y divide-border/30">
              {NOTIF_CATEGORIES.map((c) => {
                const Icon = c.icon;
                const siteOn = !prefs.muted_categories.includes(c.key);
                const pushCatOn = siteOn && !prefs.push_muted_categories.includes(c.key);
                return (
                  <div key={c.key} className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center px-4 py-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", c.tone)}><Icon className="h-3.5 w-3.5" /></span>
                      <div className="min-w-0"><div className="text-sm font-medium">{c.label}</div><div className="text-[11px] text-muted-foreground">{c.hint}</div></div>
                    </div>
                    <Switch checked={siteOn} onCheckedChange={(v) => savePrefs({ ...prefs, muted_categories: toggleIn(prefs.muted_categories, c.key, v) })} aria-label={`${c.label} no site`} />
                    <Switch checked={pushCatOn} disabled={!siteOn} onCheckedChange={(v) => savePrefs({ ...prefs, push_muted_categories: toggleIn(prefs.push_muted_categories, c.key, v) })} aria-label={`${c.label} no celular`} />
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
