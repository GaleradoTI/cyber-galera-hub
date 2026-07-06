import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SizeManagerValue = {
  sizes: string[];
  measurements: Record<string, string>;
};

export function SizeManager({
  value,
  onChange,
  label = "Tamanhos disponíveis",
  measurementsLabel = "Medidas por tamanho (opcional)",
  placeholder = "Ex: PP, GGG, 4XL…",
}: {
  value: SizeManagerValue;
  onChange: (next: SizeManagerValue) => void;
  label?: string;
  measurementsLabel?: string;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const sizes = value.sizes ?? [];
  const measurements = value.measurements ?? {};

  const add = () => {
    const s = input.trim().toUpperCase();
    if (!s) return;
    if (sizes.includes(s)) { setInput(""); return; }
    onChange({ sizes: [...sizes, s], measurements });
    setInput("");
  };

  const remove = (s: string) => {
    const next = { ...measurements };
    delete next[s];
    onChange({ sizes: sizes.filter((x) => x !== s), measurements: next });
  };

  return (
    <div className="space-y-2 rounded-md border border-border/40 p-3 bg-muted/10">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input
          className="flex-1"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          maxLength={12}
        />
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="h-3 w-3 mr-1" /> Tamanho
        </Button>
      </div>
      {sizes.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1">
            {sizes.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-primary/40 bg-primary/10 text-primary">
                {s}
                <button type="button" onClick={() => remove(s)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="space-y-2 pt-2">
            <Label className="text-xs">{measurementsLabel}</Label>
            {sizes.map((s) => (
              <div key={s} className="flex items-center gap-2">
                <span className="text-xs font-bold w-10 shrink-0">{s}</span>
                <Input
                  className="flex-1"
                  placeholder="Ex: Largura 52cm · Comprimento 72cm"
                  maxLength={200}
                  value={measurements[s] ?? ""}
                  onChange={(e) => onChange({ sizes, measurements: { ...measurements, [s]: e.target.value } })}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}