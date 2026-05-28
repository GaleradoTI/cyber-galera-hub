import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationsBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user?.id,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
  });

  const unread = items.filter((n) => !n.read_at).length;

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
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-secondary text-background text-[9px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b border-border/40">
          <div className="text-sm font-bold">Notificações</div>
          {unread > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={markAll}>
              <CheckCheck className="h-3 w-3 mr-1" /> Marcar todas
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto divide-y divide-border/30">
          {items.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Sem notificações</p>}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => markOne(n)}
              className={`w-full text-left p-3 hover:bg-muted/40 transition flex gap-2 ${!n.read_at ? "bg-primary/5" : ""}`}
            >
              <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${!n.read_at ? "bg-secondary" : "bg-muted-foreground/30"}`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{n.title}</div>
                {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                <div className="text-[10px] text-muted-foreground/70 mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</div>
              </div>
              {n.read_at && <Check className="h-3 w-3 text-muted-foreground/50 mt-1 shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}