import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DateField({
  label,
  value,
  onChange,
  required,
  error,
  min,
  hint = "Use o calendário para evitar erro de formato.",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  min?: string;
  hint?: string;
}) {
  return (
    <div>
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input type="date" value={value} min={min} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} />
      <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}