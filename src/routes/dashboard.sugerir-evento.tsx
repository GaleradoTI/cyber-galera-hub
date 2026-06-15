import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDateOnly } from "@/lib/utils";
import { ImageUploader } from "@/components/ui/image-uploader";

export const Route = createFileRoute("/dashboard/sugerir-evento")({ component: SugerirEventoPage });

type Speaker = { name: string; topic?: string; bio?: string };

const empty = {
  name: "", theme: "", description: "", event_date: new Date().toISOString().slice(0, 10),
  event_time: "", modality: "online", category: "", online_link: "", address: "",
  cover_url: "", max_attendees: "", source: "comunidade",
  speakers: [] as Speaker[],
};

function SugerirEventoPage() {
  const { user, rolesReady } = useDashboardRoles();
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);

  const { data: mine = [] } = useQuery({
    queryKey: ["my-submitted-events", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id,name,event_date,modality,source,approval_status,status,approval_note")
        .eq("submitted_by", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!user) return;
    if (!form.name.trim() || !form.description.trim() || !form.event_date) {
      return toast.error("Preencha nome, descrição e data.");
    }
    setSaving(true);
    const payload: any = {
      name: form.name, description: form.description, event_date: form.event_date,
      event_time: form.event_time || null, modality: form.modality,
      category: form.category || null, theme: form.theme || null,
      online_link: form.online_link || null, address: form.address || null,
      cover_url: form.cover_url || null,
      max_attendees: form.max_attendees ? Number(form.max_attendees) : null,
      source: form.source, submitted_by: user.id,
      status: "rascunho", approval_status: "pending",
      speakers: form.speakers.filter((s) => s.name?.trim()),
      created_by: user.id,
    };
    const { error } = await supabase.from("events").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Evento enviado para aprovação!");
    setForm({ ...empty });
    qc.invalidateQueries({ queryKey: ["my-submitted-events"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Sugestão removida");
    qc.invalidateQueries({ queryKey: ["my-submitted-events"] });
  };

  const setSpeaker = (i: number, patch: Partial<Speaker>) => {
    const list = [...form.speakers]; list[i] = { ...list[i], ...patch };
    setForm({ ...form, speakers: list });
  };

  return (
    <DashboardShell title="Sugerir evento" description="Envie um evento para a comunidade. Um administrador irá revisar antes de publicar.">
      {!user || !rolesReady ? <div className="text-muted-foreground">Carregando…</div> : (
        <div className="grid gap-6">
          <section className="glass rounded-xl p-5 border border-primary/20">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Tema</Label><Input value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })} /></div>
              <div><Label>Data *</Label><Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></div>
              <div><Label>Hora</Label><Input type="time" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} /></div>
              <div>
                <Label>Modalidade</Label>
                <Select value={form.modality} onValueChange={(v) => setForm({ ...form, modality: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="presencial">Presencial</SelectItem>
                    <SelectItem value="hibrido">Híbrido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fonte</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comunidade">Da comunidade</SelectItem>
                    <SelectItem value="terceiros">De terceiros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(form.modality === "online" || form.modality === "hibrido") && (
                <div className="sm:col-span-2"><Label>Link da call</Label><Input value={form.online_link} onChange={(e) => setForm({ ...form, online_link: e.target.value })} /></div>
              )}
              {(form.modality === "presencial" || form.modality === "hibrido") && (
                <div className="sm:col-span-2"><Label>Endereço</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              )}
              <div><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Workshop, Meetup…" /></div>
              <div><Label>Limite de vagas</Label><Input type="number" min={1} value={form.max_attendees} onChange={(e) => setForm({ ...form, max_attendees: e.target.value })} /></div>
              <div className="sm:col-span-2">
                <ImageUploader
                  bucket="project-covers"
                  folder={`events/sugestoes/${user?.id ?? "novo"}`}
                  value={form.cover_url || null}
                  onChange={(url) => setForm({ ...form, cover_url: url ?? "" })}
                  label="Banner / capa do evento"
                  aspect="wide"
                  resizeMax={1920}
                  maxBytes={8 * 1024 * 1024}
                  hint="JPG/PNG/WebP até 8MB · redimensionado para 1920px"
                />
              </div>
              <div className="sm:col-span-2"><Label>Descrição * (Markdown)</Label><MarkdownEditor value={form.description} onChange={(v) => setForm({ ...form, description: v })} rows={6} /></div>
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <Label>Palestrantes</Label>
                  <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, speakers: [...form.speakers, { name: "", topic: "", bio: "" }] })}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </div>
                {form.speakers.map((sp, i) => (
                  <div key={i} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 mb-2 items-start">
                    <Input placeholder="Nome" value={sp.name} onChange={(e) => setSpeaker(i, { name: e.target.value })} />
                    <Input placeholder="Tema" value={sp.topic ?? ""} onChange={(e) => setSpeaker(i, { topic: e.target.value })} />
                    <Button type="button" size="icon" variant="ghost" onClick={() => setForm({ ...form, speakers: form.speakers.filter((_, idx) => idx !== i) })}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={submit} disabled={saving}>Enviar para aprovação</Button>
            </div>
          </section>

          <section>
            <h2 className="font-bold text-sm mb-3">Minhas sugestões</h2>
            {mine.length === 0 ? (
              <div className="glass rounded-xl p-6 text-center text-sm text-muted-foreground"><Calendar className="h-6 w-6 mx-auto mb-2" /> Nenhuma sugestão enviada ainda.</div>
            ) : (
              <div className="grid gap-2">
                {mine.map((e: any) => (
                  <div key={e.id} className="glass rounded-xl p-3 border border-border/40 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{e.name}</div>
                      <div className="text-xs text-muted-foreground">{formatDateOnly(e.event_date)} • {e.modality} • {e.source}</div>
                      {e.approval_note && <div className="text-xs text-destructive mt-1">{e.approval_note}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={e.approval_status === "approved" ? "default" : e.approval_status === "pending" ? "secondary" : "destructive"}>
                        {e.approval_status}
                      </Badge>
                      {e.approval_status === "pending" && (
                        <Button size="sm" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 text-xs text-muted-foreground">Confira também a <Link to="/eventos" className="text-primary underline">agenda pública</Link>.</div>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}