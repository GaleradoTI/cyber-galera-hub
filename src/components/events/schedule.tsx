import { ArrowDown, ArrowUp, Clock, MapPin, Mic2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ScheduleItem } from "@/lib/events";

export function ScheduleTimeline({ items }: { items: ScheduleItem[] }) {
  if (!items.length) return null;
  return (
    <ol className="relative border-l-2 border-primary/30 ml-3 space-y-5">
      {items.map((s, i) => (
        <li key={i} className="pl-6 relative">
          <span className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full bg-primary ring-4 ring-background" />
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
            <div className="font-mono text-sm font-bold text-primary shrink-0 sm:w-28 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {s.start}{s.end ? ` – ${s.end}` : ""}
            </div>
            <div className="min-w-0">
              <div className="font-semibold">{s.title}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-0.5">
                {s.speaker && <span className="flex items-center gap-1"><Mic2 className="h-3 w-3" /> {s.speaker}</span>}
                {s.room && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.room}</span>}
              </div>
              {s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ScheduleEditor({ value, onChange }: { value: ScheduleItem[]; onChange: (v: ScheduleItem[]) => void }) {
  const set = (i: number, patch: Partial<ScheduleItem>) => onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= value.length) return;
    const list = [...value]; [list[i], list[j]] = [list[j], list[i]]; onChange(list);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Programação (grade de horários)</Label>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...value, { start: "", end: "", title: "" }])}>
          <Plus className="h-3 w-3 mr-1" /> Horário
        </Button>
      </div>
      {value.length === 0 && <p className="text-xs text-muted-foreground">Nenhum horário. Adicione abertura, palestras, intervalo, networking…</p>}
      {value.map((s, i) => (
        <div key={i} className="grid grid-cols-2 sm:grid-cols-[90px_90px_1fr_auto] gap-2 items-center glass p-3 rounded-lg border border-border/40">
          <Input type="time" aria-label="Início" value={s.start} onChange={(e) => set(i, { start: e.target.value })} />
          <Input type="time" aria-label="Fim" value={s.end ?? ""} onChange={(e) => set(i, { end: e.target.value })} />
          <Input className="col-span-2 sm:col-span-1" placeholder="Atividade *" value={s.title} onChange={(e) => set(i, { title: e.target.value })} />
          <div className="flex col-span-2 sm:col-span-1 justify-end">
            <Button type="button" size="icon" variant="ghost" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
            <Button type="button" size="icon" variant="ghost" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
            <Button type="button" size="icon" variant="ghost" onClick={() => onChange(value.filter((_, idx) => idx !== i))}><X className="h-4 w-4" /></Button>
          </div>
          <Input className="col-span-2 sm:col-span-2" placeholder="Palestrante" value={s.speaker ?? ""} onChange={(e) => set(i, { speaker: e.target.value })} />
          <Input className="col-span-2 sm:col-span-2" placeholder="Sala / trilha" value={s.room ?? ""} onChange={(e) => set(i, { room: e.target.value })} />
        </div>
      ))}
    </div>
  );
}
