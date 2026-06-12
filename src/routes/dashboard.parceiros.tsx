import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ExternalLink, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/parceiros")({ component: ParceirosAdminPage });

type Partner = {
  id: string; name: string; description: string | null; logo_url: string | null;
  website_url: string | null; display_order: number; is_active: boolean;
};

const empty: Partial<Partner> = { name: "", description: "", logo_url: "", website_url: "", display_order: 0, is_active: true };

function ParceirosAdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, user, rolesReady } = useDashboardRoles();
  const [editing, setEditing] = useState<Partial<Partner> | null>(null);
  const [removing, setRemoving] = useState<Partner | null>(null);

  useEffect(() => { if (rolesReady && !isAdmin) navigate({ to: "/dashboard" }); }, [rolesReady, isAdmin, navigate]);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["admin-partners"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("partners").select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Partner[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-partners"] });

  const save = async () => {
    if (!editing?.name) return toast.error("Nome obrigatório");
    const payload = {
      name: editing.name,
      description: editing.description || null,
      logo_url: editing.logo_url || null,
      website_url: editing.website_url || null,
      display_order: Number(editing.display_order ?? 0),
      is_active: editing.is_active ?? true,
    };
    const { error } = editing.id
      ? await (supabase as any).from("partners").update(payload).eq("id", editing.id)
      : await (supabase as any).from("partners").insert({ ...payload, created_by: user?.id });
    if (error) return toast.error(error.message);
    toast.success("Parceiro salvo");
    setEditing(null); refresh();
  };

  const remove = async () => {
    if (!removing) return;
    const { error } = await (supabase as any).from("partners").delete().eq("id", removing.id);
    if (error) return toast.error(error.message);
    toast.success("Parceiro removido");
    setRemoving(null); refresh();
  };

  const toggleActive = async (p: Partner) => {
    const { error } = await (supabase as any).from("partners").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) return toast.error(error.message);
    refresh();
  };

  return (
    <DashboardShell title="Parceiros" description="Gerencie a vitrine de parceiros exibida na home.">
      <div className="flex justify-end mb-4">
        <Button onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4 mr-1" /> Novo parceiro</Button>
      </div>
      <div className="glass rounded-xl border border-primary/20 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Logo</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Ordem</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>}
            {!isLoading && partners.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum parceiro cadastrado.</TableCell></TableRow>}
            {partners.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.logo_url ? <img src={p.logo_url} alt={p.name} className="h-10 w-auto object-contain" /> : <div className="h-10 w-10 bg-muted rounded" />}</TableCell>
                <TableCell className="font-medium">{p.name}{p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}</TableCell>
                <TableCell className="text-xs">{p.website_url ? <a href={p.website_url} target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" /> abrir</a> : "—"}</TableCell>
                <TableCell>{p.display_order}</TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => toggleActive(p)}>{p.is_active ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}</Button></TableCell>
                <TableCell className="text-right space-x-1 whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(p)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar parceiro" : "Novo parceiro"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><Label>Nome *</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Descrição (Markdown)</Label><MarkdownEditor value={editing.description ?? ""} onChange={(v) => setEditing({ ...editing, description: v })} rows={4} maxLength={500} /></div>
              <div className="sm:col-span-2"><Label>Logo (URL)</Label><Input value={editing.logo_url ?? ""} onChange={(e) => setEditing({ ...editing, logo_url: e.target.value })} placeholder="https://…/logo.png" /></div>
              <div className="sm:col-span-2"><Label>Site oficial</Label><Input value={editing.website_url ?? ""} onChange={(e) => setEditing({ ...editing, website_url: e.target.value })} placeholder="https://…" /></div>
              <div><Label>Ordem de exibição</Label><Input type="number" value={editing.display_order ?? 0} onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })} /></div>
              <div className="flex items-end gap-2"><Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Ativo (visível na home)</Label></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover parceiro?</AlertDialogTitle>
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