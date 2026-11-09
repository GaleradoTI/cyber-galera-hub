import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AMBASSADOR_AREAS, AREA_ACTIONS, ACTION_LABELS, hasAreaAccess } from "@/lib/ambassador-areas";
import { toast } from "sonner";

export function AmbassadorAccessDialog({ target, onClose }: { target: { user_id: string; display_name: string } | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [areas, setAreas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["ambassador-areas", target?.user_id],
    enabled: !!target,
    queryFn: async () => {
      if (!target) return [];
      const { data, error } = await supabase.from("ambassador_permissions").select("areas").eq("user_id", target.user_id).maybeSingle();
      if (error) throw error;
      return (data?.areas ?? []) as string[];
    },
  });
  useEffect(() => { if (data) setAreas(data); }, [data]);

  const toggle = (k: string, on: boolean) => setAreas((a) => (on ? [...new Set([...a, k])] : a.filter((x) => x !== k)));

  const save = async () => {
    if (!target) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("ambassador_permissions").upsert({ user_id: target.user_id, areas, updated_by: u.user?.id ?? null });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Acessos atualizados");
    qc.invalidateQueries({ queryKey: ["ambassador-areas", target.user_id] });
    onClose();
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Acessos de {target?.display_name}</DialogTitle>
          <DialogDescription>Escolha cada ação separadamente. Visualizar uma área não libera edição, publicação ou remoção. O cartão pessoal continua liberado.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 text-xs">
          <Button size="sm" variant="outline" onClick={() => setAreas(AMBASSADOR_AREAS.flatMap((a) => [a.key, ...AREA_ACTIONS[a.key].map((action) => `${a.key}:${action}`)]))}>Liberar todas as ações</Button>
          <Button size="sm" variant="ghost" onClick={() => setAreas([])}>Limpar</Button>
        </div>
        <div className="divide-y divide-border/40 rounded-md border border-border/40">
          {isLoading ? <p className="p-4 text-sm text-muted-foreground">Carregando…</p> : AMBASSADOR_AREAS.map((a) => (
            <section key={a.key} className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{a.label}</h3><div className="flex items-center gap-2 text-xs text-muted-foreground">Visualizar<Switch checked={hasAreaAccess(areas, a.key)} onCheckedChange={(v) => setAreas((prev) => v ? [...new Set([...prev, a.key])] : prev.filter((k) => k !== a.key && !k.startsWith(`${a.key}:`)))} aria-label={`Visualizar ${a.label}`} /></div></div>
              <div className="grid gap-3 sm:grid-cols-2">{AREA_ACTIONS[a.key].map((action) => <label key={action} className="flex items-center justify-between gap-3 text-sm"><span>{ACTION_LABELS[action]}</span><Switch checked={areas.includes(`${a.key}:${action}`)} onCheckedChange={(v) => { toggle(`${a.key}:${action}`, v); if (v) toggle(a.key, true); }} aria-label={`${ACTION_LABELS[action]} — ${a.label}`} /></label>)}</div>
            </section>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || isLoading}>{saving ? "Salvando…" : "Salvar acessos"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
