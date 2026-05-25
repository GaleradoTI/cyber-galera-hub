import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Shield, ShieldOff, Crown, ShieldCheck, User as UserIcon, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles, RoleBadge } from "@/components/dashboard/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/usuarios")({ component: UsuariosPage });

type ProfileRow = { id: string; user_id: string; display_name: string; email: string; is_blocked: boolean; created_at: string };
type RoleRow = { user_id: string; role: string };

function UsuariosPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, isSuperAdmin } = useDashboardRoles();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isAdmin) navigate({ to: "/dashboard" });
  }, [isAdmin, navigate]);

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
    return rs.includes("SUPER_ADMIN") ? "SUPER_ADMIN" : rs.includes("ADMIN") ? "ADMIN" : rs.includes("MODERADOR") ? "MODERADOR" : "MEMBRO";
  };

  const filtered = profiles.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.email?.toLowerCase().includes(q) || p.display_name?.toLowerCase().includes(q);
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-profiles"] });
    qc.invalidateQueries({ queryKey: ["admin-roles"] });
  };

  const toggleBlock = async (p: ProfileRow) => {
    const target = primaryOf(p.user_id);
    if (!isSuperAdmin && (target === "ADMIN" || target === "SUPER_ADMIN")) {
      toast.error("Apenas SUPER ADMIN pode bloquear administradores.");
      return;
    }
    const { error } = await supabase.from("profiles").update({ is_blocked: !p.is_blocked }).eq("user_id", p.user_id);
    if (error) return toast.error(error.message);
    toast.success(`${p.is_blocked ? "Reativado" : "Bloqueado"}: ${p.email}`);
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
                    <Button size="sm" variant={p.is_blocked ? "default" : "destructive"} disabled={!canActOnTarget || role === "SUPER_ADMIN"} onClick={() => toggleBlock(p)}>
                      {p.is_blocked ? "Reativar" : "Bloquear"}
                    </Button>
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
    </DashboardShell>
  );
}