import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Award, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/cargos")({ component: CargosPage });

type Badge = { id: string; user_id: string; label: string; color: string };
type Profile = { user_id: string; display_name: string; email: string };

const COLOR_OPTIONS = ["primary", "secondary", "accent", "destructive"];

function CargosPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isSuperAdmin, rolesReady, user } = useDashboardRoles();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ id?: string; user_id: string; label: string; color: string }>({ user_id: "", label: "", color: "primary" });
  const [search, setSearch] = useState("");

  useEffect(() => { if (rolesReady && !isSuperAdmin) navigate({ to: "/dashboard" }); }, [rolesReady, isSuperAdmin, navigate]);

  const { data: badges = [] } = useQuery({
    queryKey: ["member-badges"],
    queryFn: async () => {
      const { data, error } = await supabase.from("member_badges").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Badge[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles-light"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id,display_name,email").order("display_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.user_id, p])), [profiles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return badges;
    return badges.filter((b) => {
      const p = profileById.get(b.user_id);
      return b.label.toLowerCase().includes(q) || p?.display_name.toLowerCase().includes(q) || p?.email.toLowerCase().includes(q);
    });
  }, [badges, search, profileById]);

  const openCreate = () => {
    setForm({ user_id: "", label: "", color: "primary" });
    setOpen(true);
  };

  const openEdit = (b: Badge) => {
    setForm({ id: b.id, user_id: b.user_id, label: b.label, color: b.color });
    setOpen(true);
  };

  const save = async () => {
    if (!form.user_id || !form.label) return toast.error("Preencha usuário e cargo");
    const { error } = form.id
      ? await supabase.from("member_badges").update({ user_id: form.user_id, label: form.label, color: form.color }).eq("id", form.id)
      : await supabase.from("member_badges").insert({ user_id: form.user_id, label: form.label, color: form.color, created_by: user?.id ?? null });
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Cargo atualizado" : "Cargo atribuído");
    setOpen(false);
    setForm({ user_id: "", label: "", color: "primary" });
    qc.invalidateQueries({ queryKey: ["member-badges"] });
  };

  const remove = async (b: Badge) => {
    if (!confirm(`Remover cargo "${b.label}"?`)) return;
    const { error } = await supabase.from("member_badges").delete().eq("id", b.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["member-badges"] });
  };

  return (
    <DashboardShell title="Cargos / Badges" description="Atribua títulos customizados aos membros (ex: Embaixador, Líder de Projeto).">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input className="pl-7" placeholder="Buscar por cargo, nome ou e-mail…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <p className="text-sm text-muted-foreground">{filtered.length}/{badges.length}</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Atribuir cargo</Button>
      </div>

      <div className="glass rounded-xl border border-primary/20 divide-y divide-border/40">
        {filtered.map((b) => {
          const p = profileById.get(b.user_id);
          return (
            <div key={b.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Award className="h-4 w-4 text-secondary" />
                <div>
                  <div className="text-sm font-medium">{p?.display_name ?? b.user_id}</div>
                  <div className="text-xs text-muted-foreground">{p?.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-[0.2em] border-${b.color} text-${b.color}`}>
                  {b.label.toUpperCase()}
                </span>
                <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(b)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum cargo encontrado.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Editar cargo" : "Atribuir cargo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Usuário</Label>
              <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name} — {p.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Cargo</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex: Líder de Projeto" /></div>
            <div>
              <Label>Cor</Label>
              <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{form.id ? "Salvar" : "Atribuir"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}