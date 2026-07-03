import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Shield, ShieldOff, Crown, ShieldCheck, User as UserIcon, ArrowUp, ArrowDown, Pencil, KeyRound, Building2, Award, BadgeCheck, Plus, X, Eye, Mail, Phone, MapPin, Briefcase, Calendar, Tag } from "lucide-react";
import { getGenderLabel, getRegionByState, getAgeRange, BRAZIL_STATES, GENDER_OPTIONS } from "@/lib/profile-demographics";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { resetUserPassword } from "@/lib/admin-users.functions";
import { DashboardShell, useDashboardRoles, RoleBadge } from "@/components/dashboard/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/usuarios")({ component: UsuariosPage });

type ProfileRow = {
  id: string; user_id: string; display_name: string; email: string;
  is_blocked: boolean; created_at: string; is_verified_recruiter: boolean;
  gender?: string | null; birth_date?: string | null; address_state?: string | null; address_region?: string | null;
};
type RoleRow = { user_id: string; role: string };
type BadgeRow = { id: string; user_id: string; label: string; color: string };

const BADGE_COLORS = ["primary", "secondary", "accent", "destructive"];
const AGE_RANGES = ["Até 17", "18–24", "25–34", "35–44", "45–54", "55+", "Não informado"];
const REGIONS = Array.from(new Set(BRAZIL_STATES.map((s) => s.region))).sort();
const PAGE_SIZE = 20;

function UsuariosPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, isSuperAdmin, rolesReady } = useDashboardRoles();
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("__all");
  const [genderFilter, setGenderFilter] = useState("__all");
  const [ageFilter, setAgeFilter] = useState("__all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [editName, setEditName] = useState("");
  const [confirm, setConfirm] = useState<ProfileRow | null>(null);
  const [resetting, setResetting] = useState<ProfileRow | null>(null);
  const [customPwd, setCustomPwd] = useState("");
  const [badgeFilter, setBadgeFilter] = useState<string>("__all");
  const [addBadgeFor, setAddBadgeFor] = useState<ProfileRow | null>(null);
  const [newBadge, setNewBadge] = useState({ label: "", color: "primary" });
  const [viewing, setViewing] = useState<ProfileRow | null>(null);
  const resetPwdFn = useServerFn(resetUserPassword);

  useEffect(() => {
    if (rolesReady && !isAdmin) navigate({ to: "/dashboard" });
  }, [rolesReady, isAdmin, navigate]);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,user_id,display_name,email,is_blocked,created_at,is_verified_recruiter,gender,birth_date,address_state,address_region").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const { data: rolesData = [] } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id,role");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

  const { data: badgesData = [] } = useQuery({
    queryKey: ["admin-badges"],
    queryFn: async () => {
      const { data, error } = await supabase.from("member_badges").select("*");
      if (error) throw error;
      return (data ?? []) as BadgeRow[];
    },
  });

  const badgesByUser = useMemo(() => {
    const m = new Map<string, BadgeRow[]>();
    badgesData.forEach((b) => {
      const arr = m.get(b.user_id) ?? [];
      arr.push(b);
      m.set(b.user_id, arr);
    });
    return m;
  }, [badgesData]);

  const allBadgeLabels = useMemo(() => Array.from(new Set(badgesData.map((b) => b.label))).sort(), [badgesData]);

  const rolesByUser = useMemo(() => {
    const m = new Map<string, string[]>();
    rolesData.forEach((r) => {
      const arr = m.get(r.user_id) ?? [];
      arr.push(r.role);
      m.set(r.user_id, arr);
    });
    return m;
  }, [rolesData]);

  const primaryOf = (uid: string) => {
    const rs = rolesByUser.get(uid) ?? [];
    return rs.includes("SUPER_ADMIN")
      ? "SUPER_ADMIN"
      : rs.includes("ADMIN")
      ? "ADMIN"
      : rs.includes("MODERADOR")
      ? "MODERADOR"
      : rs.includes("RECRUTADOR")
      ? "RECRUTADOR"
      : "MEMBRO";
  };

  const filtered = profiles.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      if (!(p.email?.toLowerCase().includes(q) || p.display_name?.toLowerCase().includes(q))) return false;
    }
    if (badgeFilter !== "__all") {
      const bs = badgesByUser.get(p.user_id) ?? [];
      if (!bs.some((b) => b.label === badgeFilter)) return false;
    }
    if (regionFilter !== "__all") {
      const region = p.address_region || getRegionByState(p.address_state) || "Não informado";
      if (region !== regionFilter) return false;
    }
    if (genderFilter !== "__all") {
      if ((p.gender || "__none") !== genderFilter) return false;
    }
    if (ageFilter !== "__all") {
      if (getAgeRange(p.birth_date) !== ageFilter) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, regionFilter, genderFilter, ageFilter, badgeFilter]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-profiles"] });
    qc.invalidateQueries({ queryKey: ["admin-roles"] });
    qc.invalidateQueries({ queryKey: ["admin-badges"] });
    qc.invalidateQueries({ queryKey: ["member-badges"] });
    qc.invalidateQueries({ queryKey: ["roles"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const doToggleBlock = async (p: ProfileRow) => {
    const target = primaryOf(p.user_id);
    if (!isSuperAdmin && (target === "ADMIN" || target === "SUPER_ADMIN")) {
      toast.error("Apenas SUPER ADMIN pode bloquear administradores.");
      return;
    }
    const { error } = await supabase.from("profiles").update({ is_blocked: !p.is_blocked }).eq("user_id", p.user_id);
    if (error) return toast.error(error.message);
    toast.success(`${p.is_blocked ? "Reativado" : "Bloqueado"}: ${p.email}`);
    setConfirm(null);
    refresh();
  };

  const saveProfile = async () => {
    if (!editing) return;
    const { error } = await supabase.from("profiles").update({ display_name: editName }).eq("user_id", editing.user_id);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
    setEditing(null);
    refresh();
  };

  const promoteToAdmin = async (p: ProfileRow) => {
    if (!isSuperAdmin) return toast.error("Somente SUPER ADMIN.");
    const { error } = await supabase.from("user_roles").insert({ user_id: p.user_id, role: "ADMIN" });
    if (error) return toast.error(error.message);
    toast.success(`${p.email} promovido a ADMIN`);
    refresh();
  };

  const demoteFromAdmin = async (p: ProfileRow) => {
    if (!isSuperAdmin) return toast.error("Somente SUPER ADMIN.");
    const { error } = await supabase.from("user_roles").delete().eq("user_id", p.user_id).eq("role", "ADMIN");
    if (error) return toast.error(error.message);
    toast.success(`${p.email} rebaixado para MEMBRO`);
    refresh();
  };

  const toggleRecruiter = async (p: ProfileRow, currentRoles: string[]) => {
    if (!isSuperAdmin) return toast.error("Somente SUPER ADMIN.");
    const has = currentRoles.includes("RECRUTADOR");
    const op = has
      ? supabase.from("user_roles").delete().eq("user_id", p.user_id).eq("role", "RECRUTADOR")
      : supabase.from("user_roles").insert({ user_id: p.user_id, role: "RECRUTADOR" as any });
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(has ? `${p.email} deixou de ser recrutador` : `${p.email} agora é recrutador`);
    refresh();
  };

  const toggleVerified = async (p: ProfileRow) => {
    if (!isSuperAdmin) return toast.error("Somente SUPER ADMIN.");
    const { error } = await supabase.from("profiles").update({ is_verified_recruiter: !p.is_verified_recruiter }).eq("user_id", p.user_id);
    if (error) return toast.error(error.message);
    toast.success(p.is_verified_recruiter ? "Verificação removida" : "Recrutador verificado");
    refresh();
  };

  const addBadge = async () => {
    if (!addBadgeFor || !newBadge.label.trim()) return;
    const { error } = await supabase.from("member_badges").insert({
      user_id: addBadgeFor.user_id, label: newBadge.label.trim(), color: newBadge.color,
    });
    if (error) return toast.error(error.message);
    toast.success("Cargo atribuído");
    setAddBadgeFor(null);
    setNewBadge({ label: "", color: "primary" });
    refresh();
  };

  const removeBadge = async (id: string) => {
    const { error } = await supabase.from("member_badges").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const doResetPassword = async () => {
    if (!resetting) return;
    try {
      const res = await resetPwdFn({ data: { targetUserId: resetting.user_id, newPassword: customPwd || undefined } });
      toast.success(`Senha resetada. Nova senha: ${res.password}`);
      setResetting(null);
      setCustomPwd("");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao resetar");
    }
  };

  return (
    <DashboardShell title="Usuários" description={isSuperAdmin ? "Gerencie todos os usuários, papéis e status." : "Gerencie membros (ativar/bloquear)."}>
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou email" className="pl-9" />
        </div>
        {allBadgeLabels.length > 0 && (
          <Select value={badgeFilter} onValueChange={setBadgeFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar por cargo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os cargos</SelectItem>
              {allBadgeLabels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} usuário(s)</div>
      </div>

      <div className="glass rounded-xl border border-primary/20 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && filtered.map((p) => {
              const role = primaryOf(p.user_id);
              const isTargetAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
              const canActOnTarget = isSuperAdmin || !isTargetAdmin;
              const userBadges = badgesByUser.get(p.user_id) ?? [];
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-secondary/40 flex items-center justify-center text-xs font-black">
                        {(p.display_name ?? p.email).slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate flex items-center gap-1">
                          {p.display_name}
                          {p.is_verified_recruiter && (
                            <span title="Recrutador verificado"><BadgeCheck className="h-3.5 w-3.5 text-primary" /></span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                        {(userBadges.length > 0 || isSuperAdmin) && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {userBadges.map((b) => (
                              <span key={b.id} className={`group inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[9px] font-bold tracking-wider border-${b.color} text-${b.color}`}>
                                {b.label.toUpperCase()}
                                {isSuperAdmin && (
                                  <button onClick={() => removeBadge(b.id)} className="opacity-50 hover:opacity-100">
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </span>
                            ))}
                            {isSuperAdmin && (
                              <button
                                onClick={() => { setAddBadgeFor(p); setNewBadge({ label: "", color: "primary" }); }}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border border-dashed border-muted-foreground/40 text-[9px] text-muted-foreground hover:border-primary hover:text-primary"
                              >
                                <Plus className="h-2.5 w-2.5" /> CARGO
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><RoleBadge role={role} /></TableCell>
                  <TableCell>
                    {p.is_blocked ? (
                      <span className="inline-flex items-center gap-1 text-xs text-destructive"><ShieldOff className="h-3 w-3" /> Bloqueado</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-primary"><Shield className="h-3 w-3" /> Ativo</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setEditName(p.display_name ?? ""); }}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="neon-outline" onClick={() => setViewing(p)}>
                      <Eye className="h-3 w-3 mr-1" /> Ver detalhes
                    </Button>
                    {isSuperAdmin && role === "MEMBRO" && (
                      <Button size="sm" variant="outline" onClick={() => promoteToAdmin(p)}>
                        <ArrowUp className="h-3 w-3 mr-1" /> Tornar ADMIN
                      </Button>
                    )}
                    {isSuperAdmin && role === "ADMIN" && (
                      <Button size="sm" variant="outline" onClick={() => demoteFromAdmin(p)}>
                        <ArrowDown className="h-3 w-3 mr-1" /> Rebaixar
                      </Button>
                    )}
                    {isSuperAdmin && role !== "SUPER_ADMIN" && role !== "ADMIN" && (
                      <Button size="sm" variant="outline" onClick={() => toggleRecruiter(p, rolesByUser.get(p.user_id) ?? [])}>
                        <Building2 className="h-3 w-3 mr-1" />
                        {(rolesByUser.get(p.user_id) ?? []).includes("RECRUTADOR") ? "Remover recrutador" : "Tornar recrutador"}
                      </Button>
                    )}
                    {isSuperAdmin && (rolesByUser.get(p.user_id) ?? []).includes("RECRUTADOR") && (
                      <Button size="sm" variant="outline" onClick={() => toggleVerified(p)}>
                        <BadgeCheck className="h-3 w-3 mr-1" />
                        {p.is_verified_recruiter ? "Remover verificação" : "Verificar"}
                      </Button>
                    )}
                    <Button size="sm" variant={p.is_blocked ? "default" : "destructive"} disabled={!canActOnTarget || role === "SUPER_ADMIN"} onClick={() => setConfirm(p)}>
                      {p.is_blocked ? "Reativar" : "Bloquear"}
                    </Button>
                    {canActOnTarget && role !== "SUPER_ADMIN" && (
                      <Button size="sm" variant="outline" onClick={() => { setResetting(p); setCustomPwd(""); }}>
                        <KeyRound className="h-3 w-3 mr-1" /> Resetar senha
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!addBadgeFor} onOpenChange={(o) => !o && setAddBadgeFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir cargo</DialogTitle>
            <DialogDescription>{addBadgeFor?.display_name} — {addBadgeFor?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do cargo</Label>
              <Input value={newBadge.label} onChange={(e) => setNewBadge({ ...newBadge, label: e.target.value })} placeholder="Ex: Embaixador" />
            </div>
            <div>
              <Label>Cor</Label>
              <Select value={newBadge.color} onValueChange={(v) => setNewBadge({ ...newBadge, color: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BADGE_COLORS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddBadgeFor(null)}>Cancelar</Button>
            <Button onClick={addBadge}>Atribuir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-6 text-xs text-muted-foreground space-y-1">
        <p className="flex items-center gap-2"><Crown className="h-3 w-3 text-secondary" /> SUPER ADMIN: promove/rebaixa ADMIN e gerencia todos os usuários.</p>
        <p className="flex items-center gap-2"><ShieldCheck className="h-3 w-3 text-primary" /> ADMIN: gerencia (ativa/bloqueia) somente MEMBROS.</p>
        <p className="flex items-center gap-2"><UserIcon className="h-3 w-3" /> A promoção do primeiro SUPER ADMIN é feita via SQL editor por segurança.</p>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nome de exibição</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveProfile}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.is_blocked ? "Reativar usuário?" : "Bloquear usuário?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.is_blocked ? "O usuário voltará a acessar normalmente." : "O usuário não conseguirá mais acessar a comunidade até ser reativado."}<br />
              <span className="font-mono text-xs">{confirm?.email}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && doToggleBlock(confirm)}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!resetting} onOpenChange={(o) => { if (!o) { setResetting(null); setCustomPwd(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetar senha</DialogTitle>
            <DialogDescription>
              {resetting?.email}<br />
              Deixe em branco para usar a senha padrão definida em Configurações &rarr; password_policy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nova senha (opcional)</Label>
            <Input type="text" value={customPwd} onChange={(e) => setCustomPwd(e.target.value)} placeholder="Mínimo 8 caracteres" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setResetting(null); setCustomPwd(""); }}>Cancelar</Button>
            <Button onClick={doResetPassword}>Resetar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UserDetailDialog user={viewing} onClose={() => setViewing(null)} />
    </DashboardShell>
  );
}

function UserDetailDialog({ user, onClose }: { user: ProfileRow | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-profile-detail", user?.user_id],
    enabled: !!user?.user_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user!.user_id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/40 to-secondary/40 flex items-center justify-center text-sm font-black">
              {(user?.display_name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div>{user?.display_name || "Sem nome"}</div>
              <div className="text-xs font-normal text-muted-foreground">{user?.email}</div>
            </div>
          </DialogTitle>
          <DialogDescription>Detalhes completos do usuário selecionado.</DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div>
        ) : (
          <div className="grid gap-4 text-sm">
            {data.bio && (
              <div>
                <div className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground mb-1">BIO</div>
                <p className="text-muted-foreground leading-relaxed">{data.bio}</p>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <Field icon={<Mail className="h-3 w-3" />} label="E-mail" value={data.email} />
              <Field icon={<Phone className="h-3 w-3" />} label="Telefone" value={data.phone} />
              <Field icon={<Briefcase className="h-3 w-3" />} label="Área" value={data.work_area} />
              <Field icon={<UserIcon className="h-3 w-3" />} label="Gênero" value={getGenderLabel(data.gender)} />
              <Field icon={<Calendar className="h-3 w-3" />} label="Nascimento" value={data.birth_date} />
              <Field icon={<Shield className="h-3 w-3" />} label="Busca vaga" value={data.looking_for_job ? "Sim" : "Não"} />
            </div>

            {(data.address_city || data.address_state || data.address_postal_code) && (
              <div>
                <div className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> ENDEREÇO</div>
                <div className="text-muted-foreground leading-relaxed">
                  {[data.address_street, data.address_number].filter(Boolean).join(", ")}
                  {data.address_complement && ` — ${data.address_complement}`}
                  <br />
                  {[data.address_neighborhood, data.address_city, data.address_state].filter(Boolean).join(" • ")}
                  {data.address_postal_code && ` — CEP ${data.address_postal_code}`}
                  <br />
                  <span className="text-xs">{[data.address_region || getRegionByState(data.address_state), data.address_country].filter(Boolean).join(" • ")}</span>
                </div>
              </div>
            )}

            {(data.tech_tags ?? []).length > 0 && (
              <div>
                <div className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground mb-2 flex items-center gap-1"><Tag className="h-3 w-3" /> TECNOLOGIAS</div>
                <div className="flex flex-wrap gap-1.5">
                  {(data.tech_tags as string[]).map((t) => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {data.social_links && Object.keys(data.social_links).length > 0 && (
              <div>
                <div className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground mb-2">REDES</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.social_links as Record<string, string>).filter(([, v]) => v).map(([k, v]) => (
                    <a key={k} href={v.startsWith("http") ? v : `https://${v}`} target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 rounded border border-border/50 hover:border-primary hover:text-primary">
                      {k}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/40">
              Criado em {new Date(data.created_at).toLocaleString("pt-BR")}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="glass rounded-md p-2 border border-border/40">
      <div className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground flex items-center gap-1">{icon} {label}</div>
      <div className="text-sm mt-0.5 truncate">{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}