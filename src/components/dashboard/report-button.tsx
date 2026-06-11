import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const REASONS = [
  "Conteúdo inadequado / ofensivo",
  "Vaga falsa ou suspeita de golpe",
  "Spam",
  "Informação incorreta",
  "Discriminação ou assédio",
  "Outro",
];

export function ReportButton({ entityType, entityId, variant = "outline", size = "sm" }: {
  entityType: "job" | "event"; entityId: string; variant?: any; size?: any;
}) {
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [otherReason, setOtherReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isAuthenticated) return null;

  const submit = async () => {
    setBusy(true);
    const finalReason = reason === "Outro" ? (otherReason.trim() || "Outro") : reason;
    const { error } = await (supabase as any).from("reports").insert({
      reporter_id: user!.id, entity_type: entityType, entity_id: entityId,
      reason: finalReason.slice(0, 100), details: details.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Denúncia enviada — nossa equipe vai analisar");
    setOpen(false); setDetails(""); setOtherReason("");
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        <Flag className="h-3 w-3 mr-1" /> Denunciar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Denunciar {entityType === "job" ? "vaga" : "evento"}</DialogTitle>
            <DialogDescription>Use este canal para conteúdos que violem as regras da comunidade.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Motivo</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {reason === "Outro" && (
              <div><Label>Especifique</Label><Input value={otherReason} onChange={(e) => setOtherReason(e.target.value)} maxLength={100} /></div>
            )}
            <div><Label>Detalhes (opcional)</Label><Textarea rows={4} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Conte o que você notou…" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={busy}>Enviar denúncia</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}