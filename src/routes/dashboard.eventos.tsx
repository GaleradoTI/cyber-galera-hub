import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/eventos")({ component: EventosAdminPage });

type Evt = {
  id: string; name: string; description: string; event_date: string; event_time: string | null;
  modality: string; location_or_link: string | null; category: string | null; status: string;
};

const empty: Partial<Evt> = { name: "", description: "", event_date: new Date().toISOString().slice(0, 10), event_time: "", modality: "online", location_or_link: "", category: "", status: "rascunho" };

function EventosAdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, user } = useDashboardRoles();
  const [editing, setEditing] = useState<Partial<Evt> | null>(null);
  const [viewing, setViewing] = useState<Evt | null>(null);
  const [removing, setRemoving] = useState<Evt | null>(null);

  useEffect(() => { if (!isAdmin) navigate({ to: "/dashboard" }); }, [isAdmin, navigate]);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("event_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Evt[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-events"] });

  const save = async () => {
    if (!editing) return;
    const payload: any = {
      name: editing.name, description: editing.description, event_date: editing.event_date,
      event_time: editing.event_time || null, modality: editing.modality,
      location_or_link: editing.location_or_link || null, category: editing.category || null, status: editing.status,
    };
    if (!payload.name || !payload.description || !payload.event_date) return toast.error("Preencha nome, descrição e data.");
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

  return (
    <DashboardShell title="Eventos" description="Crie, edite, visualize e remova eventos da comunidade.">
      <div className="flex justify-end mb-4">
        <Button onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4 mr-1" /> Novo evento</Button>
      </div>
      <div className="glass rounded-xl border border-primary/20 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Modalidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>}
            {!isLoading && events.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum evento.</TableCell></TableRow>}
            {events.map((ev) => (
              <TableRow key={ev.id}>
                <TableCell className="font-medium">{ev.name}</TableCell>
                <TableCell>{new Date(ev.event_date).toLocaleDateString("pt-BR")} {ev.event_time?.slice(0, 5) ?? ""}</TableCell>
                <TableCell><Badge variant="outline">{ev.modality}</Badge></TableCell>
                <TableCell><Badge variant={ev.status === "publicado" ? "default" : "secondary"}>{ev.status}</Badge></TableCell>
                <TableCell className="text-right space-x-1">
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar evento" : "Novo evento"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><Label>Nome *</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
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
              <div><Label>Categoria</Label><Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Local ou link</Label><Input value={editing.location_or_link ?? ""} onChange={(e) => setEditing({ ...editing, location_or_link: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Descrição *</Label><Textarea rows={6} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
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
              {viewing && new Date(viewing.event_date).toLocaleDateString("pt-BR")} {viewing?.event_time?.slice(0, 5) ?? ""} • {viewing?.modality}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {viewing?.location_or_link && <div className="text-muted-foreground">{viewing.location_or_link}</div>}
            <p className="whitespace-pre-wrap">{viewing?.description}</p>
          </div>
        </DialogContent>
      </Dialog>

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