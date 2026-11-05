import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AMBASSADOR_AREAS } from "@/lib/ambassador-areas";
import { toast } from "sonner";

export function AmbassadorAccessDialog({ target, onClose }: { target: { user_id: string; display_name: string } | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [areas, setAreas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["ambassador-areas", target?.user_id],
    enabled: !!target,
    queryFn: async () => {
      const { data } = await supabase.from("ambassador_permissions").select("areas").eq("user_id", target!.user_id).maybeSingle();
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Acessos de {target?.display_name}</DialogTitle>
          <DialogDescription>Escolha o que este embaixador pode gerenciar. O próprio cartão de embaixador sempre fica liberado.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 text-xs">
          <Button size="sm" variant="outline" onClick={() => setAreas(AMBASSADOR_AREAS.map((a) => a.key))}>Liberar tudo</Button>
          <Button size="sm" variant="ghost" onClick={() => setAreas([])}>Limpar</Button>
        </div>
        <div className="divide-y divide-border/40 rounded-md border border-border/40">
          {isLoading ? <p className="p-4 text-sm text-muted-foreground">Carregando…</p> : AMBASSADOR_AREAS.map((a) => (
            <label key={a.key} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{a.label}</div>
                <div className="text-xs text-muted-foreground">{a.hint}</div>
              </div>
              <Switch checked={areas.includes(a.key)} onCheckedChange={(v) => toggle(a.key, v)} aria-label={a.label} />
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar acessos"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
