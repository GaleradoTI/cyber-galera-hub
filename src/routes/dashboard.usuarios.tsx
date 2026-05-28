import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Shield, ShieldOff, Crown, ShieldCheck, User as UserIcon, ArrowUp, ArrowDown, Pencil, KeyRound, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { resetUserPassword } from "@/lib/admin-users.functions";
import { DashboardShell, useDashboardRoles, RoleBadge } from "@/components/dashboard/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/usuarios")({ component: UsuariosPage });

type ProfileRow = { id: string; user_id: string; display_name: string; email: string; is_blocked: boolean; created_at: string };
type RoleRow = { user_id: string; role: string };

function UsuariosPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, isSuperAdmin, rolesReady } = useDashboardRoles();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [editName, setEditName] = useState("");
  const [confirm, setConfirm] = useState<ProfileRow | null>(null);
  const [resetting, setResetting] = useState<ProfileRow | null>(null);
  const [customPwd, setCustomPwd] = useState("");
  const resetPwdFn = useServerFn(resetUserPassword);

  useEffect(() => {
    if (rolesReady && !isAdmin) navigate({ to: "/dashboard" });
  }, [rolesReady, isAdmin, navigate]);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,user_id,display_name,email,is_blocked,created_at").order("created_at", { ascending: false });
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
    if (!search) return true;
    const q = search.toLowerCase();
    return p.email?.toLowerCase().includes(q) || p.display_name?.toLowerCase().includes(q);
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-profiles"] });
    qc.invalidateQueries({ queryKey: ["admin-roles"] });
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
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-secondary/40 flex items-center justify-center text-xs font-black">
                        {(p.display_name ?? p.email).slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{p.display_name}</div>
                        <div className="text-xs text-muted-foreground truncate">{p.email}</div>
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
    </DashboardShell>
  );
}