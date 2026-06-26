import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ImageUploader } from "@/components/ui/image-uploader";

export const Route = createFileRoute("/dashboard/comunidade-perfis")({ component: CommunityProfilesAdminPage });

type SocialLink = { label: string; url: string };
type Profile = {
  id: string;
  profile_type: string;
  name: string;
  role_title: string | null;
  photo_url: string | null;
  professional_story: string | null;
  community_role: string | null;
  social_links: SocialLink[] | Record<string, string>;
  is_active: boolean;
  display_order: number;
};

const empty: Partial<Profile> = {
  profile_type: "ambassador",
  name: "",
  role_title: "",
  photo_url: "",
  professional_story: "",
  community_role: "",
  social_links: [],
  is_active: true,
  display_order: 0,
};

function CommunityProfilesAdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isAdmin, rolesReady } = useDashboardRoles();
  const [editing, setEditing] = useState<Partial<Profile> | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => { if (rolesReady && !isAdmin) navigate({ to: "/dashboard" }); }, [rolesReady, isAdmin, navigate]);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin-community-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("community_profiles").select("*").order("profile_type").order("display_order");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const rows = useMemo(() => filter === "all" ? profiles : profiles.filter((p) => p.profile_type === filter), [profiles, filter]);

  const save = async () => {
    if (!editing) return;
    if (!editing.name?.trim()) return toast.error("Informe o nome.");
    const payload = {
      profile_type: editing.profile_type ?? "ambassador",
      name: editing.name.trim(),
      role_title: editing.role_title?.trim() || null,
      photo_url: editing.photo_url || null,
      professional_story: editing.professional_story?.trim() || null,
      community_role: editing.community_role?.trim() || null,
      social_links: normalizeLinks(editing.social_links).filter((l) => l.label.trim() && l.url.trim()),
      is_active: editing.is_active ?? true,
      display_order: Number(editing.display_order) || 0,
      created_by: user?.id ?? null,
    };
    const { error } = editing.id
      ? await supabase.from("community_profiles").update(payload).eq("id", editing.id)
      : await supabase.from("community_profiles").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Perfil salvo.");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-community-profiles"] });
    qc.invalidateQueries({ queryKey: ["community-profiles"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("community_profiles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Perfil removido.");
    qc.invalidateQueries({ queryKey: ["admin-community-profiles"] });
  };

  if (rolesReady && !isAdmin) return null;

  return (
    <DashboardShell title="Embaixadores e Administradores" description="Gerencie os perfis públicos da comunidade.">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ambassador">Embaixadores</SelectItem>
            <SelectItem value="administrator">Administradores</SelectItem>
          </SelectContent>
        </Select>
        <Button className="ml-auto" onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4 mr-1" /> Novo perfil</Button>
      </div>

      {isLoading ? <p className="text-muted-foreground text-sm">Carregando…</p> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((p) => (
            <div key={p.id} className="glass rounded-xl border border-primary/20 overflow-hidden">
              {p.photo_url ? <img src={p.photo_url} alt={p.name} className="w-full h-44 object-cover" /> : <div className="w-full h-44 bg-muted/20 flex items-center justify-center text-muted-foreground">Sem foto</div>}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold truncate">{p.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{p.role_title ?? "—"}</p>
                  </div>
                  <Badge variant={p.is_active ? "default" : "secondary"}>{p.profile_type === "ambassador" ? "Embaixador" : "Admin"}</Badge>
                </div>
                <div className="flex gap-1 mt-3">
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ ...p, social_links: normalizeLinks(p.social_links) })}><Pencil className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(p.id)}><Trash2 className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" asChild className="ml-auto"><a href={p.profile_type === "ambassador" ? "/embaixadores" : "/administradores"} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /></a></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar perfil" : "Novo perfil público"}</DialogTitle></DialogHeader>
          {editing && <ProfileForm value={editing} onChange={setEditing} />}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function normalizeLinks(value: Profile["social_links"] | undefined): SocialLink[] {
  if (Array.isArray(value)) return value as SocialLink[];
  return Object.entries(value ?? {}).map(([label, url]) => ({ label, url: String(url ?? "") }));
}

function ProfileForm({ value, onChange }: { value: Partial<Profile>; onChange: (value: Partial<Profile>) => void }) {
  const links = normalizeLinks(value.social_links);
  const setLink = (idx: number, patch: Partial<SocialLink>) => onChange({ ...value, social_links: links.map((l, i) => i === idx ? { ...l, ...patch } : l) });

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div><Label>Tipo</Label><Select value={value.profile_type ?? "ambassador"} onValueChange={(v) => onChange({ ...value, profile_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ambassador">Embaixador</SelectItem><SelectItem value="administrator">Administrador</SelectItem></SelectContent></Select></div>
      <div><Label>Ordem</Label><Input type="number" value={value.display_order ?? 0} onChange={(e) => onChange({ ...value, display_order: Number(e.target.value) })} /></div>
      <div className="sm:col-span-2"><Label>Nome *</Label><Input value={value.name ?? ""} onChange={(e) => onChange({ ...value, name: e.target.value })} /></div>
      <div className="sm:col-span-2"><Label>Cargo / título profissional</Label><Input value={value.role_title ?? ""} onChange={(e) => onChange({ ...value, role_title: e.target.value })} /></div>
      <div className="sm:col-span-2"><ImageUploader bucket="project-covers" folder="site/community-profiles" value={value.photo_url ?? null} onChange={(url) => onChange({ ...value, photo_url: url ?? "" })} label="Foto" aspect="square" policyKey="project_covers" resizeMax={1200} showDiagnostics /></div>
      <div className="sm:col-span-2"><Label>História profissional</Label><Textarea rows={5} value={value.professional_story ?? ""} onChange={(e) => onChange({ ...value, professional_story: e.target.value })} /></div>
      <div className="sm:col-span-2"><Label>O que faz na comunidade</Label><Input value={value.community_role ?? ""} onChange={(e) => onChange({ ...value, community_role: e.target.value })} /></div>
      <div className="sm:col-span-2 space-y-2">
        <div className="flex items-center justify-between"><Label>Redes sociais</Label><Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...value, social_links: [...links, { label: "", url: "" }] })}><Plus className="h-3 w-3 mr-1" /> Link</Button></div>
        {links.map((link, idx) => <div key={idx} className="grid sm:grid-cols-[160px_1fr_auto] gap-2"><Input placeholder="Rede" value={link.label} onChange={(e) => setLink(idx, { label: e.target.value })} /><Input placeholder="https://..." value={link.url} onChange={(e) => setLink(idx, { url: e.target.value })} /><Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => onChange({ ...value, social_links: links.filter((_, i) => i !== idx) })}><Trash2 className="h-4 w-4" /></Button></div>)}
      </div>
      <div className="sm:col-span-2 flex items-center gap-2"><Switch checked={value.is_active ?? true} onCheckedChange={(checked) => onChange({ ...value, is_active: checked })} /><Label>Publicado no site</Label></div>
    </div>
  );
}