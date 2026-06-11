import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircleQuestion, Check, Ban, Trash2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "@tanstack/react-router";

export function EventQA({ eventId, isAdmin }: { eventId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState<Record<string, string>>({});

  const { data: questions = [] } = useQuery({
    queryKey: ["event-qa", eventId, isAdmin],
    queryFn: async () => {
      const q = (supabase as any).from("event_questions").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
      const { data } = await q;
      return data ?? [];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["event-qa", eventId] });

  const ask = async () => {
    if (!user || !text.trim()) return;
    const { error } = await (supabase as any).from("event_questions").insert({
      event_id: eventId, user_id: user.id, content: text.trim(),
    });
    if (error) return toast.error(error.message);
    toast.success("Pergunta enviada — aguardando moderação");
    setText(""); refresh();
  };

  const moderate = async (id: string, status: "approved" | "rejected") => {
    const { error } = await (supabase as any).from("event_questions").update({
      status, moderated_by: user?.id, moderated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const reply = async (id: string) => {
    const a = (answer[id] ?? "").trim();
    if (!a) return;
    const { error } = await (supabase as any).from("event_questions").update({
      answer: a, answered_by: user?.id, answered_at: new Date().toISOString(),
      status: "approved",
    }).eq("id", id);
    if (error) return toast.error(error.message);
    setAnswer((s) => ({ ...s, [id]: "" }));
    refresh();
  };

  const del = async (id: string) => {
    const { error } = await (supabase as any).from("event_questions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  return (
    <div className="space-y-3 pt-3 border-t border-border/40">
      <div className="text-sm font-semibold flex items-center gap-2">
        <MessageCircleQuestion className="h-4 w-4 text-primary" /> Perguntas & comentários
      </div>
      {isAuthenticated ? (
        <div className="flex gap-2">
          <Textarea rows={2} maxLength={2000} placeholder="Faça uma pergunta ao organizador…" value={text} onChange={(e) => setText(e.target.value)} />
          <Button onClick={ask} disabled={!text.trim()}><Send className="h-4 w-4" /></Button>
        </div>
      ) : (
        <Link to="/login"><Button variant="outline" size="sm">Entrar para perguntar</Button></Link>
      )}
      {questions.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma pergunta ainda.</p>}
      <ul className="space-y-2">
        {questions.map((q: any) => (
          <li key={q.id} className="glass rounded-lg p-3 border border-border/40">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm whitespace-pre-wrap flex-1">{q.content}</div>
              <Badge variant={q.status === "approved" ? "default" : q.status === "rejected" ? "destructive" : "secondary"} className="text-[10px]">
                {q.status === "approved" ? "aprovada" : q.status === "rejected" ? "rejeitada" : "pendente"}
              </Badge>
            </div>
            {q.answer && (
              <div className="mt-2 pl-3 border-l-2 border-primary/40 text-sm">
                <div className="text-[10px] uppercase tracking-wider text-primary font-bold">Resposta da organização</div>
                <div className="whitespace-pre-wrap">{q.answer}</div>
              </div>
            )}
            {isAdmin && (
              <div className="mt-2 flex flex-wrap gap-2 items-end">
                {q.status !== "approved" && <Button size="sm" variant="ghost" onClick={() => moderate(q.id, "approved")}><Check className="h-3 w-3 mr-1 text-primary" /> Aprovar</Button>}
                {q.status !== "rejected" && <Button size="sm" variant="ghost" onClick={() => moderate(q.id, "rejected")}><Ban className="h-3 w-3 mr-1" /> Rejeitar</Button>}
                <Button size="sm" variant="ghost" onClick={() => del(q.id)}><Trash2 className="h-3 w-3 mr-1 text-destructive" /> Apagar</Button>
                <div className="flex gap-2 flex-1 min-w-[200px]">
                  <Textarea rows={1} placeholder="Responder…" value={answer[q.id] ?? ""} onChange={(e) => setAnswer((s) => ({ ...s, [q.id]: e.target.value }))} />
                  <Button size="sm" onClick={() => reply(q.id)} disabled={!(answer[q.id] ?? "").trim()}><Send className="h-3 w-3" /></Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}