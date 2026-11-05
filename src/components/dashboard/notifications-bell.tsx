import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { categoryMeta, timeAgo } from "@/lib/notification-meta";
import { cn } from "@/lib/utils";

export type Notification = {
  id: string; type: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string;
};

export function NotificationRow({ n, onClick }: { n: Notification; onClick: () => void }) {
  const meta = categoryMeta(n.type);
  const Icon = meta.icon;
  return (
    <button onClick={onClick} className={cn("w-full text-left p-3 hover:bg-muted/40 transition flex gap-3", !n.read_at && "bg-primary/5")}>
      <span className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0", meta.tone)}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className={cn("text-sm flex-1 line-clamp-2", !n.read_at ? "font-semibold" : "text-muted-foreground")}>{n.title}</div>
          {!n.read_at && <span className="mt-1.5 h-2 w-2 rounded-full bg-secondary shrink-0" aria-label="Não lida" />}
        </div>
        {n.body && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>}
        <div className="text-[10px] text-muted-foreground/70 mt-1">{meta.label} · {timeAgo(n.created_at)}</div>
      </div>
    </button>
  );
}

export function NotificationsBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");

  const { data: items = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user?.id,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*").eq("user_id", user!.id)
        .order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
  });

  // Atualiza ao voltar para a aba
  useEffect(() => {
    const f = () => document.visibilityState === "visible" && qc.invalidateQueries({ queryKey: ["notifications"] });
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, [qc]);

  const unread = items.filter((n) => !n.read_at).length;
  const list = tab === "unread" ? items.filter((n) => !n.read_at) : items;

  const markOne = async (n: Notification) => {
    if (!n.read_at) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
    setOpen(false);
    if (n.link) navigate({ to: n.link });
  };
  const markAll = async () => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null).eq("user_id", user!.id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notificações (${unread} não lidas)` : "Notificações"}>
          <Bell className={cn("h-5 w-5", unread > 0 && "text-primary")} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-secondary text-background text-[9px] font-bold flex items-center justify-center animate-in zoom-in">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-2rem)] sm:w-96 p-0">
        <div className="flex items-center justify-between p-3 border-b border-border/40">
          <div className="text-sm font-bold">Notificações</div>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={markAll}><CheckCheck className="h-3 w-3 mr-1" /> Marcar todas</Button>
            )}
            <Button asChild size="icon" variant="ghost" className="h-7 w-7" aria-label="Preferências de notificação">
              <Link to="/dashboard/notificacoes" onClick={() => setOpen(false)}><Settings2 className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
        </div>
        <div className="flex gap-1 p-2 border-b border-border/40" role="tablist">
          {(["all", "unread"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={cn("px-3 py-1 rounded-full text-xs transition", tab === t ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground hover:bg-muted/40")}>
              {t === "all" ? "Todas" : `Não lidas${unread ? ` (${unread})` : ""}`}
            </button>
          ))}
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/30">
          {list.length === 0 && (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">{tab === "unread" ? "Tudo lido por aqui." : "Sem notificações ainda."}</p>
            </div>
          )}
          {list.map((n) => <NotificationRow key={n.id} n={n} onClick={() => markOne(n)} />)}
        </div>
        <Link to="/dashboard/notificacoes" onClick={() => setOpen(false)} className="block p-2.5 text-center text-xs font-medium text-primary border-t border-border/40 hover:bg-muted/30">
          Ver todas e configurar
        </Link>
      </PopoverContent>
    </Popover>
  );
}
