import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Search, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const searchSchema = z.object({ to: z.string().optional() });

export const Route = createFileRoute("/dashboard/mensagens")({
  validateSearch: searchSchema,
  component: MensagensPage,
});

type DM = { id: string; sender_id: string; recipient_id: string; content: string; read_at: string | null; created_at: string };
type Profile = { user_id: string; display_name: string; email: string; avatar_url: string | null };

function MensagensPage() {
  const { user } = useDashboardRoles();
  const qc = useQueryClient();
  const search = useSearch({ from: "/dashboard/mensagens" });
  const [active, setActive] = useState<string | null>(search.to ?? null);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (search.to) setActive(search.to);
  }, [search.to]);

  const { data: messages = [] } = useQuery({
    queryKey: ["dms-all", user?.id],
    enabled: !!user?.id,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DM[];
    },
  });

  const partnerIds = useMemo(() => {
    const s = new Set<string>();
    messages.forEach((m) => s.add(m.sender_id === user?.id ? m.recipient_id : m.sender_id));
    if (active) s.add(active);
    return Array.from(s);
  }, [messages, user?.id, active]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["dms-profiles", partnerIds.join(",")],
    enabled: partnerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id,display_name,email,avatar_url").in("user_id", partnerIds);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
  const profileById = useMemo(() => new Map(profiles.map((p) => [p.user_id, p])), [profiles]);

  // build conversation list with last message + unread count
  const conversations = useMemo(() => {
    const m = new Map<string, { partnerId: string; last: DM; unread: number }>();
    messages.forEach((msg) => {
      const pid = msg.sender_id === user?.id ? msg.recipient_id : msg.sender_id;
      const cur = m.get(pid);
      const unreadDelta = msg.recipient_id === user?.id && !msg.read_at ? 1 : 0;
      if (!cur || new Date(msg.created_at) > new Date(cur.last.created_at)) {
        m.set(pid, { partnerId: pid, last: msg, unread: (cur?.unread ?? 0) + unreadDelta });
      } else {
        cur.unread += unreadDelta;
      }
    });
    return Array.from(m.values()).sort((a, b) => new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime());
  }, [messages, user?.id]);

  const filteredConvs = conversations.filter((c) => {
    if (!filter) return true;
    const p = profileById.get(c.partnerId);
    const q = filter.toLowerCase();
    return p?.display_name.toLowerCase().includes(q) || p?.email.toLowerCase().includes(q);
  });

  const thread = useMemo(() => {
    if (!active) return [];
    return messages.filter((m) => m.sender_id === active || m.recipient_id === active);
  }, [messages, active]);

  // mark unread incoming as read when opening
  useEffect(() => {
    if (!active || !user?.id) return;
    const unreadIds = thread.filter((m) => m.recipient_id === user.id && !m.read_at).map((m) => m.id);
    if (unreadIds.length === 0) return;
    supabase.from("direct_messages").update({ read_at: new Date().toISOString() }).in("id", unreadIds).then(() => {
      qc.invalidateQueries({ queryKey: ["dms-all"] });
    });
  }, [active, thread, user?.id, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.length, active]);

  const send = async () => {
    if (!active || !draft.trim() || !user?.id) return;
    const content = draft.trim().slice(0, 4000);
    const { error } = await supabase.from("direct_messages").insert({
      sender_id: user.id, recipient_id: active, content,
    });
    if (error) return toast.error(error.message);
    setDraft("");
    qc.invalidateQueries({ queryKey: ["dms-all"] });
  };

  const activeProfile = active ? profileById.get(active) : null;

  return (
    <DashboardShell title="Mensagens" description="Conversas diretas com outros membros da galera.">
      <div className="grid md:grid-cols-[280px_1fr] gap-4 min-h-[60vh]">
        <aside className="glass rounded-xl border border-primary/20 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input className="pl-7 h-8 text-xs" placeholder="Buscar conversa…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredConvs.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">Sem conversas ainda.</p>}
            {filteredConvs.map((c) => {
              const p = profileById.get(c.partnerId);
              const isActive = c.partnerId === active;
              return (
                <button
                  key={c.partnerId}
                  onClick={() => setActive(c.partnerId)}
                  className={`w-full text-left p-3 hover:bg-muted/30 transition border-b border-border/20 ${isActive ? "bg-primary/10" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-primary/40 to-secondary/40 flex items-center justify-center text-xs font-black">
                      {(p?.display_name ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate flex items-center gap-1">
                        {p?.display_name ?? "Usuário"}
                        {c.unread > 0 && <span className="h-4 px-1 rounded-full bg-secondary text-background text-[9px] font-bold">{c.unread}</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">{c.last.content}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="glass rounded-xl border border-primary/20 flex flex-col">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              <div className="text-center">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
                Selecione uma conversa
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-border/40 font-semibold text-sm">
                {activeProfile?.display_name ?? "Conversa"}
                <span className="text-xs text-muted-foreground ml-2">{activeProfile?.email}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {thread.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${mine ? "bg-primary text-primary-foreground" : "bg-muted/40"}`}>
                        {m.content}
                        <div className={`text-[9px] mt-1 ${mine ? "opacity-70" : "text-muted-foreground"}`}>
                          {new Date(m.created_at).toLocaleString("pt-BR")}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <div className="p-3 border-t border-border/40 flex gap-2">
                <Textarea
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                  placeholder="Escreva uma mensagem…"
                  className="resize-none"
                />
                <Button onClick={send} disabled={!draft.trim()}><Send className="h-4 w-4" /></Button>
              </div>
            </>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}