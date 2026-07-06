import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ImageUploader } from "@/components/ui/image-uploader";
import { SizeManager } from "@/components/dashboard/size-manager";
import { centsToMoneyInput, moneyInputToCents } from "@/lib/formatters";

export type DropVariant = {
  id: string;
  drop_id: string;
  name: string;
  material: string | null;
  price_cents: number | null;
  available_sizes: string[];
  size_measurements: Record<string, string>;
  images: string[];
  display_order: number;
  is_active: boolean;
};

export function DropVariantsDialog({
  drop, userId, onClose,
}: { drop: { id: string; title: string } | null; userId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<DropVariant> | null>(null);

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ["drop-variants", drop?.id],
    enabled: !!drop?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("drop_variants").select("*").eq("drop_id", drop!.id).order("display_order");
      if (error) throw error;
      return (data ?? []).map((v: any) => ({
        ...v,
        available_sizes: v.available_sizes ?? [],
        size_measurements: (v.size_measurements ?? {}) as Record<string, string>,
        images: v.images ?? [],
      })) as DropVariant[];
    },
  });

  const startNew = () => setEditing({
    name: "", material: "", price_cents: null,
    available_sizes: [], size_measurements: {}, images: [],
    display_order: variants.length, is_active: true,
  });

  const save = async () => {
    if (!editing || !drop) return;
    if (!editing.name?.trim()) return toast.error("Informe o nome da variante");
    const payload = {
      drop_id: drop.id,
      name: editing.name.trim(),
      material: editing.material?.trim() || null,
      price_cents: editing.price_cents == null ? null : Number(editing.price_cents),
      available_sizes: editing.available_sizes ?? [],
      size_measurements: editing.size_measurements ?? {},
      images: editing.images ?? [],
      display_order: Number(editing.display_order) || 0,
      is_active: editing.is_active ?? true,
    };
    const { error } = editing.id
      ? await supabase.from("drop_variants").update(payload as any).eq("id", editing.id)
      : await supabase.from("drop_variants").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Variante atualizada" : "Variante criada");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["drop-variants", drop.id] });
    qc.invalidateQueries({ queryKey: ["public-drop-variants"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta variante?")) return;
    const { error } = await supabase.from("drop_variants").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Variante excluída");
    qc.invalidateQueries({ queryKey: ["drop-variants", drop!.id] });
  };

  return (
    <Dialog open={!!drop} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Variantes — {drop?.title}</DialogTitle>
          <DialogDescription>
            Modelagens diferentes (tradicional, baby look, oversize…). Cada uma tem seus próprios tamanhos, medidas e material.
          </DialogDescription>
        </DialogHeader>

        {!editing && (
          <>
            <div className="flex justify-end"><Button size="sm" onClick={startNew}><Plus className="h-3 w-3 mr-1" /> Nova variante</Button></div>
            {isLoading && <p className="text-xs text-muted-foreground">Carregando…</p>}
            <div className="space-y-2">
              {variants.map((v) => (
                <div key={v.id} className="rounded-md border border-border/40 p-3 bg-muted/10 flex items-start gap-3">
                  {v.images?.[0] ? <img src={v.images[0]} alt="" className="w-16 h-16 object-cover rounded" /> :
                    <div className="w-16 h-16 rounded bg-primary/10" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      {v.name}
                      {!v.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">inativa</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{v.material ?? "Sem material"} · {v.available_sizes.join(", ") || "Sem tamanhos"}</div>
                    {v.price_cents != null && <div className="text-xs text-primary font-bold">{centsToMoneyInput(v.price_cents)}</div>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(v)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(v.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
              {!isLoading && variants.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhuma variante ainda. O drop usará os tamanhos definidos no cadastro principal.</p>
              )}
            </div>
          </>
        )}

        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Nome *</Label><Input maxLength={80} placeholder="Ex: Baby Look" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Ordem</Label><Input type="number" value={editing.display_order ?? 0} onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Material</Label><Input maxLength={120} placeholder="Ex: Algodão 100%" value={editing.material ?? ""} onChange={(e) => setEditing({ ...editing, material: e.target.value })} /></div>
              <div>
                <Label>Preço próprio (opcional)</Label>
                <Input inputMode="numeric" placeholder="Herda do drop se vazio"
                  value={editing.price_cents != null ? centsToMoneyInput(editing.price_cents) : ""}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    setEditing({ ...editing, price_cents: raw === "" ? null : moneyInputToCents(raw) });
                  }} />
              </div>
            </div>
            <SizeManager
              value={{ sizes: editing.available_sizes ?? [], measurements: editing.size_measurements ?? {} }}
              onChange={(v) => setEditing({ ...editing, available_sizes: v.sizes, measurements: undefined as any, size_measurements: v.measurements })}
            />
            <div>
              <Label>Imagens da variante</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {(editing.images ?? []).map((img, i) => (
                  <div key={i} className="relative">
                    <img src={img} alt="" className="w-full h-20 object-cover rounded border border-border/40" />
                    <button type="button" onClick={() => setEditing({ ...editing, images: (editing.images ?? []).filter((_, idx) => idx !== i) })}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-xs">×</button>
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <ImageUploader
                  bucket="project-covers"
                  folder={`drops/${userId ?? "shared"}`}
                  onChange={(url) => url && setEditing({ ...editing, images: [...(editing.images ?? []), url] })}
                  label="Adicionar imagem"
                  aspect="square"
                  maxBytes={8 * 1024 * 1024}
                  policyKey="drop_images"
                  auditEntity="drop_variant_image"
                  auditEntityId={editing.id ?? null}
                />
              </div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Ativa</Label></div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}><X className="h-3 w-3 mr-1" /> Voltar</Button>
              <Button onClick={save}><Save className="h-3 w-3 mr-1" /> Salvar variante</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}