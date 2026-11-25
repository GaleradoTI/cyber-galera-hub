import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, CameraOff, CheckCircle2, History, Keyboard, Search, UserCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PersonAvatar } from "@/components/jobs/shared";
import { handle } from "@/lib/people";
import { cn } from "@/lib/utils";

export type CheckinPerson = {
  ticket_code: string; status: string; checked_in_at: string | null;
  profile?: { display_name?: string | null; nickname?: string | null; avatar_url?: string | null; work_area?: string | null };
};

type Result = {
  result: "ok" | "already" | "not_approved" | "not_found"; name?: string; nickname?: string | null; avatar_url?: string | null;
  work_area?: string | null; checked_in_at?: string | null; code: string;
};

const LOOK = {
  ok: { title: "Presença confirmada", icon: CheckCircle2, tone: "text-emerald-400", ring: "ring-emerald-400", bg: "bg-emerald-500/15" },
  already: { title: "Esse ingresso já fez check-in", icon: AlertTriangle, tone: "text-amber-300", ring: "ring-amber-300", bg: "bg-amber-400/15" },
  not_approved: { title: "Inscrição não aprovada", icon: XCircle, tone: "text-destructive", ring: "ring-destructive", bg: "bg-destructive/15" },
  not_found: { title: "Ingresso não é deste evento", icon: XCircle, tone: "text-destructive", ring: "ring-destructive", bg: "bg-destructive/15" },
};

const AUTO_CLOSE_MS = 4000;
const CODE = /^GTI-[A-Z0-9]+-[A-Z0-9]+$/;

/** Aviso sonoro e vibração: quem está na portaria não precisa olhar a tela para saber se passou. */
function signal(ok: boolean) {
  try { navigator.vibrate?.(ok ? 120 : [90, 70, 90]); } catch { /* sem suporte */ }
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const audio = new Ctx();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + (ok ? 0.12 : 0.3));
    osc.onended = () => { audio.close(); };
  } catch { /* sem áudio */ }
}

export function CheckinPanel({ eventId, people, onDone }: { eventId: string; people: CheckinPerson[]; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<(Result & { at: number })[]>([]);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const busyRef = useRef(false);
  const openRef = useRef(false);
  const recentRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  openRef.current = !!result;

  const approved = people.filter((p) => p.status === "approved");
  const present = approved.filter((p) => p.checked_in_at).length;
  const percent = approved.length ? Math.round((present / approved.length) * 100) : 0;

  const check = async (raw: string) => {
    const ticket = raw.trim().toUpperCase();
    if (!ticket || busyRef.current) return;
    if (!CODE.test(ticket)) { setErrorMessage("Este QR Code não é um ingresso da Galera do TI."); return; }
    busyRef.current = true; setBusy(true); setErrorMessage("");
    try {
      const { data, error } = await supabase.rpc("checkin_by_code", { _code: ticket, _event_id: eventId });
      if (error) throw error;
      const next = { ...(data as any), code: ticket } as Result;
      setResult(next);
      setHistory((h) => [{ ...next, at: Date.now() }, ...h].slice(0, 8));
      setCode(""); setSearch("");
      signal(next.result === "ok");
      onDone();
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Não foi possível confirmar. Tente novamente.");
      signal(false);
    } finally { busyRef.current = false; setBusy(false); }
  };

  // A câmera fica ligada; a ref garante que a leitura use sempre a versão atual da função.
  const checkRef = useRef(check);
  checkRef.current = check;

  useEffect(() => {
    if (!scanning) return;
    let stopped = false;
    let scanner: any = null;
    let started: Promise<unknown> = Promise.resolve();
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (stopped) return;
      scanner = new Html5Qrcode("qr-reader");
      started = scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 240 }, (text: string) => {
        // enquanto o resultado está na tela, ou logo após ler o mesmo ingresso, ignora
        if (openRef.current || busyRef.current) return;
        if (text === recentRef.current.code && Date.now() - recentRef.current.at < 8000) return;
        recentRef.current = { code: text, at: Date.now() };
        checkRef.current(text);
      }, () => {}).catch((e: any) => { toast.error("Não foi possível abrir a câmera: " + (e?.message ?? e)); setScanning(false); });
    });
    return () => { stopped = true; started.then(() => scanner?.stop()).catch(() => {}); };
  }, [scanning]);

  // Entrada liberada fecha sozinha para a fila andar; problemas esperam um toque.
  useEffect(() => {
    if (result?.result !== "ok") return;
    const timer = setTimeout(() => setResult(null), AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [result]);

  const close = () => { recentRef.current.at = Date.now(); setResult(null); };
  const q = search.trim().toLowerCase().replace(/^@/, "");
  const matches = q.length < 2 ? [] : approved.filter((p) => [p.profile?.display_name, p.profile?.nickname, p.ticket_code].some((v) => v?.toLowerCase().includes(q))).slice(0, 6);
  const look = result ? LOOK[result.result] : null;

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl border border-primary/25 p-4">
        <div className="flex items-end justify-between gap-2">
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><UserCheck className="h-4 w-4 text-primary" /> Presentes</p>
          <p className="tabular-nums"><span className="text-3xl font-black">{present}</span><span className="text-muted-foreground"> / {approved.length} aprovados</span></p>
        </div>
        <div className="mt-2 h-2.5 rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Presença">
          <div className="h-2.5 rounded-full bg-gradient-neon transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <section className="glass rounded-xl border border-border/40 p-4 space-y-3">
          <Button variant={scanning ? "outline" : "neon"} size="lg" className="w-full" onClick={() => setScanning((v) => !v)}>
            {scanning ? <><CameraOff className="h-5 w-5 mr-2" /> Parar câmera</> : <><Camera className="h-5 w-5 mr-2" /> Ler QR Code</>}
          </Button>
          {scanning ? (
            <>
              <div id="qr-reader" className="w-full min-h-64 overflow-hidden rounded-lg" />
              <p className="text-xs text-muted-foreground text-center">A câmera continua ligada. Aponte para o próximo ingresso.</p>
            </>
          ) : <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">Toque em “Ler QR Code” para começar a entrada.</p>}
          {errorMessage && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}
        </section>

        <section className="glass rounded-xl border border-border/40 p-4 space-y-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold mb-2"><Search className="h-4 w-4 text-primary" /> Sem QR Code? Busque a pessoa</h3>
            <Input aria-label="Buscar por nome, nick ou código" placeholder="Nome, @nick ou código" value={search} onChange={(e) => setSearch(e.target.value)} />
            <ul className="mt-2 space-y-1.5">
              {matches.map((p) => (
                <li key={p.ticket_code} className="flex items-center gap-2 rounded-lg border border-border/40 p-2">
                  <PersonAvatar name={p.profile?.display_name ?? "?"} url={p.profile?.avatar_url} className="h-9 w-9 text-xs" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{p.profile?.display_name ?? "Participante"}</span><span className="block truncate text-xs text-secondary">{handle(p.profile?.nickname)}</span></span>
                  {p.checked_in_at ? <span className="text-xs text-muted-foreground">Já entrou</span> : <Button size="sm" disabled={busy} onClick={() => check(p.ticket_code)}>Confirmar</Button>}
                </li>
              ))}
              {q.length >= 2 && matches.length === 0 && <li className="text-xs text-muted-foreground">Ninguém aprovado com essa busca.</li>}
            </ul>
          </div>
          <form className="flex gap-2 border-t border-border/40 pt-3" onSubmit={(e) => { e.preventDefault(); check(code); }}>
            <div className="relative flex-1">
              <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input aria-label="Código do ingresso" placeholder="GTI-XXXX-XX" className="pl-9 font-mono uppercase" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <Button type="submit" variant="outline" disabled={busy || !code.trim()}>{busy ? "…" : "Confirmar"}</Button>
          </form>
        </section>
      </div>

      {history.length > 0 && (
        <section className="glass rounded-xl border border-border/40 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold mb-2"><History className="h-4 w-4 text-primary" /> Últimas leituras neste aparelho</h3>
          <ul className="divide-y divide-border/40">
            {history.map((h) => {
              const item = LOOK[h.result];
              return (
                <li key={h.at} className="flex items-center gap-3 py-2">
                  <item.icon className={cn("h-4 w-4 shrink-0", item.tone)} />
                  <span className="min-w-0 flex-1 truncate text-sm">{h.name ?? h.code} <span className="text-secondary">{handle(h.nickname)}</span></span>
                  <span className="text-xs text-muted-foreground">{new Date(h.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Dialog open={!!result} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="max-w-md text-center">
          {result && look && (
            <div role="status" aria-live="assertive" className="flex flex-col items-center gap-3">
              <div className={cn("mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5", look.bg, look.tone)}>
                <look.icon className="h-6 w-6" /><DialogTitle className="text-base font-black">{look.title}</DialogTitle>
              </div>
              {result.name ? (
                <>
                  <PersonAvatar name={result.name} url={result.avatar_url} className={cn("h-32 w-32 text-3xl ring-4", look.ring)} />
                  <p className="text-3xl font-black leading-tight break-words">{result.name}</p>
                  {result.nickname && <p className="rounded-full border border-secondary/50 bg-secondary/10 px-4 py-1 text-xl font-bold text-secondary break-all">{handle(result.nickname)}</p>}
                  {result.work_area && <p className="text-sm text-muted-foreground">{result.work_area}</p>}
                </>
              ) : <p className="py-4 text-sm text-muted-foreground">Confira se a pessoa abriu o ingresso do evento certo.</p>}
              <DialogDescription className="font-mono text-xs">
                {result.code}{result.checked_in_at ? ` · entrada às ${new Date(result.checked_in_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
              </DialogDescription>
              <Button className="w-full" size="lg" onClick={close}>{result.result === "ok" ? "Próximo" : "Entendi"}</Button>
              {result.result === "ok" && <div aria-hidden className="h-1 w-full overflow-hidden rounded-full bg-muted"><div className="h-1 bg-emerald-400" style={{ animation: `gti-shrink ${AUTO_CLOSE_MS}ms linear forwards` }} /></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
