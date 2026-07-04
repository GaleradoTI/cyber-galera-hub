import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Eye, Search, ChevronLeft, ChevronRight } from "lucide-react";
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

export const Route = createFileRoute("/dashboard/vagas")({ component: VagasAdminPage });

type Job = {
  id: string; title: string; company: string; description: string; short_description: string | null;
  seniority: string; modality: string; location: string | null; apply_url: string | null;
  technologies: string[]; status: string; created_at: string;
};

const empty: Partial<Job> = { title: "", company: "", description: "", short_description: "", seniority: "pleno", modality: "remoto", location: "", apply_url: "", technologies: [], status: "rascunho" };

function VagasAdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, isRecruiter, isAmbassador, user, rolesReady } = useDashboardRoles();
  const [editing, setEditing] = useState<Partial<Job> | null>(null);
  const [viewing, setViewing] = useState<Job | null>(null);
  const [removing, setRemoving] = useState<Job | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modalityFilter, setModalityFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    if (rolesReady && !isAdmin && !isRecruiter && !isAmbassador) navigate({ to: "/dashboard" });
  }, [rolesReady, isAdmin, isRecruiter, isAmbassador, navigate]);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["admin-jobs", isAdmin ? "all" : user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase.from("jobs").select("*").order("created_at", { ascending: false });
      if (!isAdmin) q = q.eq("created_by", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Job[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-jobs"] });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (modalityFilter !== "all" && j.modality !== modalityFilter) return false;
      if (!q) return true;
      return (
        j.title?.toLowerCase().includes(q) ||
        j.company?.toLowerCase().includes(q) ||
        (j.technologies ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [jobs, search, statusFilter, modalityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => { setPage(1); }, [search, statusFilter, modalityFilter]);

  const save = async () => {
    if (!editing) return;
    const payload: any = {
      title: editing.title, company: editing.company, description: editing.description,
      short_description: editing.short_description || null, seniority: editing.seniority,
      modality: editing.modality, location: editing.location || null, apply_url: editing.apply_url || null,
      technologies: editing.technologies ?? [], status: editing.status,
    };
    if (!payload.title || !payload.company || !payload.description) return toast.error("Preencha título, empresa e descrição.");
    const { error } = editing.id
      ? await supabase.from("jobs").update(payload).eq("id", editing.id)
      : await supabase.from("jobs").insert({ ...payload, created_by: user?.id });
    if (error) return toast.error(error.message);
    toast.success("Vaga salva");
    setEditing(null);
    refresh();
  };

  const remove = async () => {
    if (!removing) return;
    const { error } = await supabase.from("jobs").delete().eq("id", removing.id);
    if (error) return toast.error(error.message);
    toast.success("Vaga removida");
    setRemoving(null);
    refresh();
  };

  return (
    <DashboardShell title="Vagas" description="Crie, edite, visualize e remova vagas tech.">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar título, empresa ou tecnologia" className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="publicado">Publicado</SelectItem>
            <SelectItem value="arquivado">Arquivado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={modalityFilter} onValueChange={setModalityFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Modalidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas modalidades</SelectItem>
            <SelectItem value="remoto">Remoto</SelectItem>
            <SelectItem value="presencial">Presencial</SelectItem>
            <SelectItem value="hibrido">Híbrido</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setEditing({ ...empty })} className="ml-auto"><Plus className="h-4 w-4 mr-1" /> Nova vaga</Button>
      </div>
      <div className="glass rounded-xl border border-primary/20 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Modalidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando vagas…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                {jobs.length === 0 ? "Nenhuma vaga cadastrada. Clique em \"Nova vaga\" para começar." : "Nenhuma vaga corresponde aos filtros."}
              </TableCell></TableRow>
            )}
            {!isLoading && paginated.map((j) => (
              <TableRow key={j.id}>
                <TableCell className="font-medium">{j.title}</TableCell>
                <TableCell>{j.company}</TableCell>
                <TableCell><Badge variant="outline">{j.modality}</Badge></TableCell>
                <TableCell><Badge variant={j.status === "publicado" ? "default" : "secondary"}>{j.status}</Badge></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => setViewing(j)}><Eye className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(j)}><Pencil className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(j)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {!isLoading && filtered.length > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <div className="text-muted-foreground">{filtered.length} vaga(s) — página {currentPage} de {totalPages}</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar vaga" : "Nova vaga"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><Label>Título *</Label><Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div><Label>Empresa *</Label><Input value={editing.company ?? ""} onChange={(e) => setEditing({ ...editing, company: e.target.value })} /></div>
              <div><Label>Local</Label><Input value={editing.location ?? ""} onChange={(e) => setEditing({ ...editing, location: e.target.value })} /></div>
              <div>
                <Label>Senioridade</Label>
                <Select value={editing.seniority} onValueChange={(v) => setEditing({ ...editing, seniority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="estagio">Estágio</SelectItem>
                    <SelectItem value="junior">Júnior</SelectItem>
                    <SelectItem value="pleno">Pleno</SelectItem>
                    <SelectItem value="senior">Sênior</SelectItem>
                    <SelectItem value="especialista">Especialista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Modalidade</Label>
                <Select value={editing.modality} onValueChange={(v) => setEditing({ ...editing, modality: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="remoto">Remoto</SelectItem>
                    <SelectItem value="presencial">Presencial</SelectItem>
                    <SelectItem value="hibrido">Híbrido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2"><Label>URL de candidatura</Label><Input value={editing.apply_url ?? ""} onChange={(e) => setEditing({ ...editing, apply_url: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Tecnologias (separadas por vírgula)</Label><Input value={(editing.technologies ?? []).join(", ")} onChange={(e) => setEditing({ ...editing, technologies: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
              <div className="sm:col-span-2"><Label>Resumo</Label><Textarea rows={2} value={editing.short_description ?? ""} onChange={(e) => setEditing({ ...editing, short_description: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Descrição completa * (Markdown)</Label><MarkdownEditor value={editing.description ?? ""} onChange={(v) => setEditing({ ...editing, description: v })} rows={8} /></div>
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
            <DialogTitle>{viewing?.title}</DialogTitle>
            <DialogDescription>{viewing?.company} • {viewing?.modality} • {viewing?.location ?? "—"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-1">{viewing?.technologies?.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}</div>
            {viewing?.short_description && <p className="text-muted-foreground">{viewing.short_description}</p>}
            <MarkdownView>{viewing?.description ?? ""}</MarkdownView>
            {viewing?.apply_url && <a className="text-primary underline" href={viewing.apply_url} target="_blank" rel="noreferrer">Link de candidatura</a>}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover vaga?</AlertDialogTitle>
            <AlertDialogDescription>"{removing?.title}" será removida permanentemente.</AlertDialogDescription>
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