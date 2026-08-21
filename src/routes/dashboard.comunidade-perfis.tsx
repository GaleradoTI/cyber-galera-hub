import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ExternalLink, Search, Eye, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  user_id?: string | null;
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
  const { user, isAdmin, isAmbassador, rolesReady } = useDashboardRoles();
  const [editing, setEditing] = useState<Partial<Profile> | null>(null);
  const [viewing, setViewing] = useState<Profile | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("__all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  useEffect(() => { if (rolesReady && !isAdmin && !isAmbassador) navigate({ to: "/dashboard" }); }, [rolesReady, isAdmin, isAmbassador, navigate]);
  const canManageAll = isAdmin;
  const canEdit = (p: Profile) => isAdmin || (isAmbassador && p.user_id === user?.id);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin-community-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("community_profiles").select("*").order("profile_type").order("display_order");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((p) => {
      if (filter !== "all" && p.profile_type !== filter) return false;
      if (areaFilter !== "__all" && (p.role_title ?? "").toLowerCase() !== areaFilter.toLowerCase()) return false;
      if (q) {
        const hay = `${p.name} ${p.role_title ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [profiles, filter, search, areaFilter]);

  const areaOptions = useMemo(() => Array.from(new Set(profiles.map((p) => p.role_title).filter(Boolean) as string[])).sort(), [profiles]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, filter, areaFilter]);

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

  if (rolesReady && !isAdmin && !isAmbassador) return null;

  return (
    <DashboardShell title="Embaixadores e Administradores" description="Gerencie os perfis públicos da comunidade.">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou cargo" className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ambassador">Embaixadores</SelectItem>
            <SelectItem value="administrator">Administradores</SelectItem>
          </SelectContent>
        </Select>
        {areaOptions.length > 0 && (
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Área/Cargo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas as áreas</SelectItem>
              {areaOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="text-xs text-muted-foreground">{filtered.length} perfil(is)</div>
        {canManageAll && (
          <Button className="ml-auto" onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4 mr-1" /> Novo perfil</Button>
        )}
      </div>

      {isLoading ? <p className="text-muted-foreground text-sm">Carregando…</p> : (
        <>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((p) => (
            <div key={p.id} className="glass rounded-xl border border-primary/20 overflow-hidden">
              {p.photo_url ? <img src={p.photo_url} alt={p.name} className="w-full h-44 object-contain bg-muted/20" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <div className="w-full h-44 bg-muted/20 flex items-center justify-center text-muted-foreground">Sem foto</div>}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold truncate">{p.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{p.role_title ?? "—"}</p>
                  </div>
                  <Badge variant={p.is_active ? "default" : "secondary"}>{p.profile_type === "ambassador" ? "Embaixador" : "Admin"}</Badge>
                </div>
                <div className="flex gap-1 mt-3">
                  <Button size="sm" variant="ghost" onClick={() => setViewing(p)}><Eye className="h-3 w-3" /></Button>
                  {canEdit(p) && (
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ ...p, social_links: normalizeLinks(p.social_links) })}><Pencil className="h-3 w-3" /></Button>
                  )}
                  {canManageAll && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(p.id)}><Trash2 className="h-3 w-3" /></Button>
                  )}
                  <Button size="sm" variant="ghost" asChild className="ml-auto"><a href={p.profile_type === "ambassador" ? "/embaixadores" : "/administradores"} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /></a></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
            <span>Página {currentPage} de {totalPages}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Próxima</Button>
            </div>
          </div>
        )}
        </>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar perfil" : "Novo perfil público"}</DialogTitle>
            <DialogDescription>Envie a foto, revise o diagnóstico se houver erro e salve para publicar no site.</DialogDescription>
          </DialogHeader>
          {editing && <ProfileForm value={editing} onChange={setEditing} />}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProfileDetailDialog
        profile={viewing}
        canManage={canManageAll}
        onClose={() => setViewing(null)}
        onChanged={() => {
          qc.invalidateQueries({ queryKey: ["admin-community-profiles"] });
          qc.invalidateQueries({ queryKey: ["community-profiles"] });
        }}
      />
    </DashboardShell>
  );
}

function normalizeLinks(value: Profile["social_links"] | undefined): SocialLink[] {
  if (Array.isArray(value)) return value as SocialLink[];
  return Object.entries(value ?? {}).map(([label, url]) => ({ label, url: String(url ?? "") }));
}

function ProfileDetailDialog({
  profile, canManage, onClose, onChanged,
}: { profile: Profile | null; canManage: boolean; onClose: () => void; onChanged: () => void }) {
  const [term, setTerm] = useState("");
  const [linked, setLinked] = useState<{ user_id: string; display_name: string | null; email: string } | null>(null);
  const links = profile ? normalizeLinks(profile.social_links) : [];

  useEffect(() => {
    (async () => {
      setLinked(null);
      setTerm("");
      if (!profile?.user_id) return;
      const { data } = await supabase.from("profiles").select("user_id,display_name,email").eq("user_id", profile.user_id).maybeSingle();
      if (data) setLinked(data as any);
    })();
  }, [profile?.id, profile?.user_id]);

  const { data: results = [] } = useQuery({
    queryKey: ["community-link-search", term],
    enabled: !!profile && canManage && term.trim().length >= 2,
    queryFn: async () => {
      const t = `%${term.trim()}%`;
      const { data } = await supabase.from("profiles")
        .select("user_id,display_name,email")
        .or(`display_name.ilike.${t},email.ilike.${t}`)
        .limit(10);
      return data ?? [];
    },
  });

  const link = async (userId: string | null) => {
    if (!profile) return;
    const { error } = await supabase.from("community_profiles").update({ user_id: userId }).eq("id", profile.id);
    if (error) return toast.error(error.message);
    toast.success(userId ? "Usuário vinculado" : "Vínculo removido");
    onChanged();
    onClose();
  };

  return (
    <Dialog open={!!profile} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {profile && (
          <>
            <DialogHeader>
              <DialogTitle>{profile.name}</DialogTitle>
              <DialogDescription>{profile.profile_type === "ambassador" ? "Embaixador" : "Administrador"} · {profile.role_title ?? "—"}</DialogDescription>
            </DialogHeader>
            <div className="grid sm:grid-cols-[160px_1fr] gap-4">
              <div>
                {profile.photo_url ? (
                  <img src={profile.photo_url} alt={profile.name} className="w-full aspect-square object-contain bg-muted/20 rounded-lg border border-border/40" />
                ) : (
                  <div className="w-full aspect-square bg-muted/20 rounded-lg flex items-center justify-center text-xs text-muted-foreground">Sem foto</div>
                )}
                <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                  <span>Ordem: {profile.display_order}</span>
                  <span>{profile.is_active ? "Publicado" : "Rascunho"}</span>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                {profile.professional_story && (
                  <div>
                    <div className="text-[10px] tracking-widest text-muted-foreground mb-1">HISTÓRIA</div>
                    <p className="whitespace-pre-wrap text-muted-foreground">{profile.professional_story}</p>
                  </div>
                )}
                {profile.community_role && (
                  <div>
                    <div className="text-[10px] tracking-widest text-muted-foreground mb-1">NA COMUNIDADE</div>
                    <p>{profile.community_role}</p>
                  </div>
                )}
                {links.length > 0 && (
                  <div>
                    <div className="text-[10px] tracking-widest text-muted-foreground mb-1">REDES</div>
                    <div className="flex flex-wrap gap-2">
                      {links.filter((l) => l.url.trim()).map((l, i) => (
                        <a key={i} href={l.url.startsWith("http") ? l.url : `https://${l.url}`} target="_blank" rel="noreferrer"
                          className="text-xs px-2 py-1 rounded border border-border/50 hover:border-primary hover:text-primary">
                          {l.label || l.url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-md border border-border/40 p-3 bg-muted/10 mt-2 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] tracking-widest text-muted-foreground">USUÁRIO VINCULADO</div>
                {linked && canManage && (
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => link(null)}>
                    <Unlink className="h-3 w-3 mr-1" /> Desvincular
                  </Button>
                )}
              </div>
              {linked ? (
                <div className="text-sm">
                  <div className="font-semibold">{linked.display_name ?? "(sem nome)"}</div>
                  <div className="text-xs text-muted-foreground">{linked.email}</div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic">Nenhum usuário vinculado.</div>
              )}

              {canManage && (
                <div className="pt-2 border-t border-border/30 space-y-2">
                  <Label className="text-xs">Buscar usuário para vincular</Label>
                  <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Nome ou email…" />
                  {term.length >= 2 && (
                    <div className="max-h-52 overflow-y-auto space-y-1">
                      {results.map((p: any) => (
                        <button key={p.user_id} type="button" onClick={() => link(p.user_id)}
                          className="w-full text-left p-2 rounded border border-border/40 hover:border-primary hover:bg-primary/5 text-xs">
                          <div className="font-semibold">{p.display_name ?? "(sem nome)"}</div>
                          <div className="text-muted-foreground">{p.email}</div>
                        </button>
                      ))}
                      {results.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhum usuário</p>}
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Fechar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
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
      <div className="sm:col-span-2"><ImageUploader bucket="project-covers" folder="site/community-profiles" value={value.photo_url ?? null} onChange={(url) => onChange({ ...value, photo_url: url ?? "" })} label="Foto" aspect="square" policyKey="project_covers" resizeMax={1200} auditEntity="community_profile_photo" auditEntityId={value.id ?? value.profile_type ?? null} showDiagnostics hint="JPG/PNG/WebP · pasta project-covers/site/community-profiles · use Diagnóstico se o Storage negar por RLS" /></div>
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