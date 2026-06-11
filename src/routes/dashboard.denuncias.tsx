import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, Check, Ban, EyeOff, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/denuncias")({ component: DenunciasAdminPage });

type Report = {
  id: string; reporter_id: string; entity_type: "job" | "event"; entity_id: string;
  reason: string; details: string | null; status: string;
  resolution_note: string | null; created_at: string;
};

function DenunciasAdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, rolesReady } = useDashboardRoles();
  const [tab, setTab] = useState<"open" | "all">("open");
  const [acting, setActing] = useState<{ report: Report; action: "resolved" | "dismissed" | "unpublished" } | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => { if (rolesReady && !isAdmin) navigate({ to: "/dashboard" }); }, [rolesReady, isAdmin, navigate]);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("reports").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Report[];
    },
  });

  const ids = useMemo(() => ({
    jobs: Array.from(new Set(reports.filter((r) => r.entity_type === "job").map((r) => r.entity_id))),
    events: Array.from(new Set(reports.filter((r) => r.entity_type === "event").map((r) => r.entity_id))),
    users: Array.from(new Set(reports.map((r) => r.reporter_id))),
  }), [reports]);

  const { data: entityMap = {} } = useQuery({
    queryKey: ["report-entities", reports.length],
    enabled: reports.length > 0,
    queryFn: async () => {
      const map: Record<string, { name: string; status: string }> = {};
      if (ids.jobs.length) {
        const { data } = await supabase.from("jobs").select("id,title,status").in("id", ids.jobs);
        (data ?? []).forEach((j: any) => { map[`job:${j.id}`] = { name: j.title, status: j.status }; });
      }
      if (ids.events.length) {
        const { data } = await supabase.from("events").select("id,name,status").in("id", ids.events);
        (data ?? []).forEach((e: any) => { map[`event:${e.id}`] = { name: e.name, status: e.status }; });
      }
      return map;
    },
  });

  const { data: reporters = {} } = useQuery({
    queryKey: ["report-users", ids.users.join(",")],
    enabled: ids.users.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id,display_name,email").in("user_id", ids.users);
      const m: Record<string, any> = {};
      (data ?? []).forEach((p: any) => { m[p.user_id] = p; });
      return m;
    },
  });

  const filtered = tab === "open" ? reports.filter((r) => r.status === "open") : reports;
  const openCount = reports.filter((r) => r.status === "open").length;

  const submit = async () => {
    if (!acting) return;
    const { error } = await (supabase as any).rpc("resolve_report", {
      _report_id: acting.report.id, _action: acting.action, _note: note || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Denúncia atualizada");
    setActing(null); setNote("");
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
    qc.invalidateQueries({ queryKey: ["report-entities"] });
  };

  return (
    <DashboardShell title="Denúncias" description="Vagas e eventos reportados pela comunidade.">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-4">
        <TabsList>
          <TabsTrigger value="open">Em aberto ({openCount})</TabsTrigger>
          <TabsTrigger value="all">Todas ({reports.length})</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="glass rounded-xl border border-primary/20 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Conteúdo</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Reportado por</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma denúncia.</TableCell></TableRow>}
            {filtered.map((r) => {
              const ent = entityMap[`${r.entity_type}:${r.entity_id}`];
              const rep = reporters[r.reporter_id];
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge variant="outline" className="mr-2">{r.entity_type === "job" ? "Vaga" : "Evento"}</Badge>
                    <span className="font-medium">{ent?.name ?? r.entity_id.slice(0, 8)}</span>
                    {ent?.status && <span className="text-[10px] uppercase ml-2 text-muted-foreground">{ent.status}</span>}
                  </TableCell>
                  <TableCell className="max-w-[260px]">
                    <div className="font-medium text-sm">{r.reason}</div>
                    {r.details && <div className="text-xs text-muted-foreground line-clamp-2">{r.details}</div>}
                  </TableCell>
                  <TableCell className="text-xs">{rep?.display_name ?? "—"}<div className="text-muted-foreground">{rep?.email}</div></TableCell>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "open" ? "secondary" : r.status === "unpublished" ? "destructive" : "default"}>{r.status}</Badge>
                    {r.resolution_note && <div className="text-[10px] text-muted-foreground mt-1">{r.resolution_note}</div>}
                  </TableCell>
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    {r.status === "open" ? (
                      <>
                        <Button size="sm" variant="ghost" title="Resolver" onClick={() => { setActing({ report: r, action: "resolved" }); setNote(""); }}><Check className="h-3 w-3 text-primary" /></Button>
                        <Button size="sm" variant="ghost" title="Improcedente" onClick={() => { setActing({ report: r, action: "dismissed" }); setNote(""); }}><Ban className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" title="Despublicar" onClick={() => { setActing({ report: r, action: "unpublished" }); setNote(""); }}><EyeOff className="h-3 w-3 text-destructive" /></Button>
                      </>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!acting} onOpenChange={(o) => { if (!o) { setActing(null); setNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Flag className="h-4 w-4 text-primary" />
              {acting?.action === "resolved" && "Marcar como resolvida"}
              {acting?.action === "dismissed" && "Marcar como improcedente"}
              {acting?.action === "unpublished" && "Despublicar conteúdo"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {acting?.action === "unpublished"
              ? "O conteúdo vai voltar para rascunho e o autor será notificado."
              : "O autor do conteúdo será notificado com a sua nota (se preenchida)."}
          </p>
          <Textarea placeholder="Nota interna / mensagem ao autor (opcional)" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setActing(null); setNote(""); }}>Cancelar</Button>
            <Button onClick={submit}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}