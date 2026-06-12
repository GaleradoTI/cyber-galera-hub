import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Eye, Users, BarChart3, Mail, Phone, X, Check, Ban, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownEditor, MarkdownView } from "@/components/ui/markdown-editor";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadCSV } from "@/lib/csv";
import { formatDateOnly } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/eventos")({ component: EventosAdminPage });

type Speaker = { name: string; topic?: string; bio?: string };
type Evt = {
  id: string; name: string; description: string; event_date: string; event_time: string | null;
  modality: string; location_or_link: string | null; category: string | null; status: string;
  theme: string | null; online_link: string | null; address: string | null; cover_url: string | null;
  max_attendees: number | null; speakers: Speaker[];
  source: string; approval_status: string; submitted_by: string | null; approval_note: string | null;
};

const empty: Partial<Evt> = {
  name: "", description: "", event_date: new Date().toISOString().slice(0, 10), event_time: "",
  modality: "online", location_or_link: "", category: "", status: "rascunho",
  theme: "", online_link: "", address: "", cover_url: "", max_attendees: null, speakers: [],
  source: "comunidade", approval_status: "approved",
};

function EventosAdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, user, rolesReady } = useDashboardRoles();
  const [editing, setEditing] = useState<Partial<Evt> | null>(null);
  const [viewing, setViewing] = useState<Evt | null>(null);
  const [removing, setRemoving] = useState<Evt | null>(null);
  const [metricsFor, setMetricsFor] = useState<Evt | null>(null);
  const [tab, setTab] = useState<"all" | "pending">("all");

  useEffect(() => { if (rolesReady && !isAdmin) navigate({ to: "/dashboard" }); }, [rolesReady, isAdmin, navigate]);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("event_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((e: any) => ({ ...e, speakers: Array.isArray(e.speakers) ? e.speakers : [] })) as Evt[];
    },
  });

  const filtered = useMemo(
    () => tab === "pending" ? events.filter((e) => e.approval_status === "pending") : events,
    [events, tab],
  );
  const pendingCount = useMemo(() => events.filter((e) => e.approval_status === "pending").length, [events]);

  const { data: counts = {} } = useQuery({
    queryKey: ["admin-event-counts"],
    queryFn: async () => {
      const [{ data: ci }, { data: it }] = await Promise.all([
        supabase.from("event_checkins").select("event_id"),
        supabase.from("user_event_interests").select("event_id"),
      ]);
      const map: Record<string, { checkins: number; interests: number }> = {};
      (ci ?? []).forEach((r: any) => { map[r.event_id] = map[r.event_id] ?? { checkins: 0, interests: 0 }; map[r.event_id].checkins++; });
      (it ?? []).forEach((r: any) => { map[r.event_id] = map[r.event_id] ?? { checkins: 0, interests: 0 }; map[r.event_id].interests++; });
      return map;
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-events"] });

  const save = async () => {
    if (!editing) return;
    const payload: any = {
      name: editing.name, description: editing.description, event_date: editing.event_date,
      event_time: editing.event_time || null, modality: editing.modality,
      location_or_link: editing.location_or_link || null, category: editing.category || null, status: editing.status,
      theme: editing.theme || null,
      online_link: editing.online_link || null,
      address: editing.address || null,
      cover_url: editing.cover_url || null,
      max_attendees: editing.max_attendees ? Number(editing.max_attendees) : null,
      speakers: (editing.speakers ?? []).filter((s) => s.name?.trim()),
      source: editing.source ?? "comunidade",
      approval_status: editing.approval_status ?? "approved",
    };
    if (!payload.name || !payload.description || !payload.event_date) return toast.error("Preencha nome, descrição e data.");
    if (editing.modality === "online" && !payload.online_link && !payload.location_or_link) return toast.error("Informe o link da call para eventos online.");
    if (editing.modality === "presencial" && !payload.address && !payload.location_or_link) return toast.error("Informe o endereço para eventos presenciais.");
    const { error } = editing.id
      ? await supabase.from("events").update(payload).eq("id", editing.id)
      : await supabase.from("events").insert({ ...payload, created_by: user?.id });
    if (error) return toast.error(error.message);
    toast.success("Evento salvo");
    setEditing(null);
    refresh();
  };

  const remove = async () => {
    if (!removing) return;
    const { error } = await supabase.from("events").delete().eq("id", removing.id);
    if (error) return toast.error(error.message);
    toast.success("Evento removido");
    setRemoving(null);
    refresh();
  };

  const setSpeaker = (i: number, patch: Partial<Speaker>) => {
    if (!editing) return;
    const list = [...(editing.speakers ?? [])];
    list[i] = { ...list[i], ...patch };
    setEditing({ ...editing, speakers: list });
  };
  const addSpeaker = () => setEditing(editing ? { ...editing, speakers: [...(editing.speakers ?? []), { name: "", topic: "", bio: "" }] } : editing);
  const removeSpeaker = (i: number) => setEditing(editing ? { ...editing, speakers: (editing.speakers ?? []).filter((_, idx) => idx !== i) } : editing);

  const moderate = async (ev: Evt, status: "approved" | "rejected") => {
    const patch: any = { approval_status: status };
    if (status === "approved") patch.status = "publicado";
    const { error } = await supabase.from("events").update(patch).eq("id", ev.id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Evento aprovado e publicado" : "Evento rejeitado");
    refresh();
  };

  return (
    <DashboardShell title="Eventos" description="Crie, edite, visualize e remova eventos da comunidade.">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="all">Todos ({events.length})</TabsTrigger>
            <TabsTrigger value="pending">Pendentes {pendingCount > 0 && <Badge className="ml-2">{pendingCount}</Badge>}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4 mr-1" /> Novo evento</Button>
      </div>
      <div className="glass rounded-xl border border-primary/20 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Modalidade</TableHead>
              <TableHead>Fonte</TableHead>
              <TableHead>Aprov.</TableHead>
              <TableHead>Check-ins</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum evento.</TableCell></TableRow>}
            {filtered.map((ev) => (
              <TableRow key={ev.id}>
                <TableCell className="font-medium">{ev.name}</TableCell>
                <TableCell>{formatDateOnly(ev.event_date)} {ev.event_time?.slice(0, 5) ?? ""}</TableCell>
                <TableCell><Badge variant="outline">{ev.modality}</Badge></TableCell>
                <TableCell><Badge variant={ev.source === "comunidade" ? "default" : "secondary"}>{ev.source === "comunidade" ? "Comunidade" : "Terceiros"}</Badge></TableCell>
                <TableCell>
                  <Badge variant={ev.approval_status === "approved" ? "default" : ev.approval_status === "pending" ? "secondary" : "destructive"}>
                    {ev.approval_status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{counts[ev.id]?.checkins ?? 0} / {counts[ev.id]?.interests ?? 0} int.</TableCell>
                <TableCell><Badge variant={ev.status === "publicado" ? "default" : "secondary"}>{ev.status}</Badge></TableCell>
                <TableCell className="text-right space-x-1 whitespace-nowrap">
                  {ev.approval_status === "pending" && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => moderate(ev, "approved")} title="Aprovar"><Check className="h-3 w-3 text-primary" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => moderate(ev, "rejected")} title="Rejeitar"><Ban className="h-3 w-3 text-destructive" /></Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setMetricsFor(ev)} title="Métricas e participantes"><BarChart3 className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setViewing(ev)}><Eye className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(ev)}><Pencil className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(ev)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar evento" : "Novo evento"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><Label>Nome *</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Tema / assunto principal</Label><Input value={editing.theme ?? ""} onChange={(e) => setEditing({ ...editing, theme: e.target.value })} placeholder="Ex: Boas práticas em React" /></div>
              <div><Label>Data *</Label><Input type="date" value={editing.event_date ?? ""} onChange={(e) => setEditing({ ...editing, event_date: e.target.value })} /></div>
              <div><Label>Hora</Label><Input type="time" value={editing.event_time ?? ""} onChange={(e) => setEditing({ ...editing, event_time: e.target.value })} /></div>
              <div>
                <Label>Modalidade</Label>
                <Select value={editing.modality} onValueChange={(v) => setEditing({ ...editing, modality: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="presencial">Presencial</SelectItem>
                    <SelectItem value="hibrido">Híbrido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Categoria</Label><Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="Workshop, Palestra, Meetup…" /></div>
              <div>
                <Label>Fonte do evento</Label>
                <Select value={editing.source ?? "comunidade"} onValueChange={(v) => setEditing({ ...editing, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comunidade">Comunidade (destaque na home)</SelectItem>
                    <SelectItem value="terceiros">Terceiros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Aprovação</Label>
                <Select value={editing.approval_status ?? "approved"} onValueChange={(v) => setEditing({ ...editing, approval_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="rejected">Rejeitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(editing.modality === "online" || editing.modality === "hibrido") && (
                <div className="sm:col-span-2"><Label>Link da call (Meet, Zoom…)</Label><Input value={editing.online_link ?? ""} onChange={(e) => setEditing({ ...editing, online_link: e.target.value })} placeholder="https://meet.google.com/…" /></div>
              )}
              {(editing.modality === "presencial" || editing.modality === "hibrido") && (
                <div className="sm:col-span-2"><Label>Endereço presencial</Label><Input value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} placeholder="Rua, número, cidade…" /></div>
              )}
              <div className="sm:col-span-2"><Label>Imagem de capa (URL)</Label><Input value={editing.cover_url ?? ""} onChange={(e) => setEditing({ ...editing, cover_url: e.target.value })} placeholder="https://…" /></div>
              <div><Label>Limite de vagas</Label><Input type="number" min={1} value={editing.max_attendees ?? ""} onChange={(e) => setEditing({ ...editing, max_attendees: e.target.value ? Number(e.target.value) : null })} /></div>
              <div className="sm:col-span-2"><Label>Descrição * (Markdown)</Label><MarkdownEditor value={editing.description ?? ""} onChange={(v) => setEditing({ ...editing, description: v })} rows={8} /></div>
              <div>
                <Label>Status</Label>
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="publicado">Publicado</SelectItem>
                    <SelectItem value="arquivado">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-2 pt-3 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <Label>Palestrantes</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addSpeaker}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
                </div>
                {(editing.speakers ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nenhum palestrante cadastrado.</p>}
                {(editing.speakers ?? []).map((sp, i) => (
                  <div key={i} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-start glass p-3 rounded-lg border border-border/40">
                    <Input placeholder="Nome *" value={sp.name ?? ""} onChange={(e) => setSpeaker(i, { name: e.target.value })} />
                    <Input placeholder="Tema da palestra" value={sp.topic ?? ""} onChange={(e) => setSpeaker(i, { topic: e.target.value })} />
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeSpeaker(i)}><X className="h-4 w-4" /></Button>
                    <Textarea placeholder="Mini bio (opcional)" className="sm:col-span-3" rows={2} value={sp.bio ?? ""} onChange={(e) => setSpeaker(i, { bio: e.target.value })} />
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
            <DialogDescription>
              {viewing && formatDateOnly(viewing.event_date)} {viewing?.event_time?.slice(0, 5) ?? ""} • {viewing?.modality}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {viewing?.theme && <div><strong>Tema:</strong> {viewing.theme}</div>}
            {viewing?.online_link && <div><strong>Link:</strong> <a className="text-secondary underline break-all" href={viewing.online_link} target="_blank" rel="noreferrer">{viewing.online_link}</a></div>}
            {viewing?.address && <div><strong>Endereço:</strong> {viewing.address}</div>}
            <MarkdownView>{viewing?.description ?? ""}</MarkdownView>
            {(viewing?.speakers ?? []).length > 0 && (
              <div>
                <div className="font-semibold mb-2">Palestrantes</div>
                <ul className="space-y-2">
                  {viewing!.speakers.map((s, i) => (
                    <li key={i} className="glass rounded p-3 border border-border/40">
                      <div className="font-medium">{s.name}</div>
                      {s.topic && <div className="text-xs text-primary">{s.topic}</div>}
                      {s.bio && <div className="text-xs text-muted-foreground mt-1">{s.bio}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <MetricsDialog event={metricsFor} onClose={() => setMetricsFor(null)} />

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover evento?</AlertDialogTitle>
            <AlertDialogDescription>"{removing?.name}" será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}

function MetricsDialog({ event, onClose }: { event: Evt | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["event-metrics", event?.id],
    enabled: !!event?.id,
    queryFn: async () => {
      const [ci, it] = await Promise.all([
        supabase.from("event_checkins").select("user_id, checked_in_at").eq("event_id", event!.id),
        supabase.from("user_event_interests").select("user_id, created_at").eq("event_id", event!.id),
      ]);
      const wl: any = await (supabase as any).from("event_waitlist").select("user_id, position, created_at").eq("event_id", event!.id).order("position");
      const ids = Array.from(new Set([
        ...(ci.data ?? []).map((r: any) => r.user_id),
        ...(it.data ?? []).map((r: any) => r.user_id),
        ...((wl.data ?? []) as any[]).map((r: any) => r.user_id),
      ]));
      let profiles: any[] = [];
      let roles: any[] = [];
      if (ids.length) {
        const [p, r] = await Promise.all([
          supabase.from("profiles").select("user_id, display_name, email, phone, avatar_url, work_area").in("user_id", ids),
          supabase.from("user_roles").select("user_id, role").in("user_id", ids),
        ]);
        profiles = p.data ?? [];
        roles = r.data ?? [];
      }
      const roleMap: Record<string, string[]> = {};
      roles.forEach((r: any) => { (roleMap[r.user_id] = roleMap[r.user_id] ?? []).push(r.role); });
      const profMap = new Map(profiles.map((p) => [p.user_id, p]));
      const checkedSet = new Set((ci.data ?? []).map((r: any) => r.user_id));
      const wlMap = new Map(((wl.data ?? []) as any[]).map((r: any) => [r.user_id, r.position]));
      const interestedSet = new Set((it.data ?? []).map((r: any) => r.user_id));
      const rows = ids.map((id) => ({
        ...(profMap.get(id) ?? { user_id: id, display_name: "—", email: "—", phone: null, work_area: null }),
        roles: roleMap[id] ?? [],
        checked_in: checkedSet.has(id),
        interested: interestedSet.has(id),
        waitlist_position: wlMap.get(id) ?? null,
      }));
      return { rows, checkins: ci.data?.length ?? 0, interests: it.data?.length ?? 0, waitlist: (wl.data ?? []).length };
    },
  });
  const conv = useMemo(() => {
    if (!data || data.interests === 0) return 0;
    return Math.round((data.checkins / data.interests) * 100);
  }, [data]);
  return (
    <Dialog open={!!event} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> {event?.name}</DialogTitle>
          <DialogDescription>Métricas de inscrição e check-in.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            disabled={!data?.rows?.length}
            onClick={() => {
              if (!data?.rows?.length || !event) return;
              downloadCSV(
                `evento-${event.name.replace(/\W+/g, "-").toLowerCase()}-participantes.csv`,
                data.rows.map((r: any) => ({
                  nome: r.display_name,
                  email: r.email,
                  telefone: r.phone ?? "",
                  area: r.work_area ?? "",
                  papel: (r.roles ?? []).join("|"),
                  status: r.checked_in ? "check-in" : r.interested ? "inscrito" : r.waitlist_position ? `lista-espera-${r.waitlist_position}` : "—",
                  posicao_espera: r.waitlist_position ?? "",
                })),
              );
            }}
          ><Download className="h-3 w-3 mr-1" /> Exportar CSV</Button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="glass rounded-lg p-4 border border-primary/20"><div className="text-xs text-muted-foreground">Interesses</div><div className="text-2xl font-black text-gradient-neon">{data?.interests ?? "…"}</div></div>
          <div className="glass rounded-lg p-4 border border-primary/20"><div className="text-xs text-muted-foreground">Check-ins</div><div className="text-2xl font-black text-gradient-neon">{data?.checkins ?? "…"}</div></div>
          <div className="glass rounded-lg p-4 border border-primary/20"><div className="text-xs text-muted-foreground">Lista de espera</div><div className="text-2xl font-black text-gradient-neon">{data?.waitlist ?? "…"}</div></div>
          <div className="glass rounded-lg p-4 border border-primary/20"><div className="text-xs text-muted-foreground">Conversão</div><div className="text-2xl font-black text-gradient-neon">{conv}%</div></div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Carregando…</TableCell></TableRow>}
              {!isLoading && (data?.rows.length ?? 0) === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Ninguém ainda.</TableCell></TableRow>}
              {data?.rows.map((r: any) => (
                <TableRow key={r.user_id}>
                  <TableCell>
                    <div className="font-medium">{r.display_name}</div>
                    {r.work_area && <div className="text-xs text-muted-foreground">{r.work_area}</div>}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex items-center gap-1"><Mail className="h-3 w-3" /> {r.email}</div>
                    {r.phone && <div className="flex items-center gap-1 mt-1"><Phone className="h-3 w-3" /> {r.phone}</div>}
                  </TableCell>
                  <TableCell className="text-xs">{r.roles.join(", ") || "—"}</TableCell>
                  <TableCell>
                    {r.checked_in
                      ? <Badge>Check-in</Badge>
                      : r.waitlist_position
                      ? <Badge variant="outline">Espera #{r.waitlist_position}</Badge>
                      : <Badge variant="secondary">Inscrito</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}