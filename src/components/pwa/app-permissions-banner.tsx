import { useEffect, useState } from "react";
import { Bell, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { enablePush, pushEnabledHere, pushSupported, requestCamera } from "@/lib/pwa";

const DISMISS_KEY = "gti-permissions-dismissed";

/** Cartão que explica e pede as permissões do celular (notificações e câmera). */
export function AppPermissionsBanner() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !pushSupported()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    pushEnabledHere().then((on) => setShow(!on));
  }, [user]);

  if (!show || !user) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  const onNotify = async () => {
    setBusy(true);
    try {
      await enablePush(user.id);
      toast.success("Notificações ativadas neste aparelho!");
      setShow(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onCamera = async () => {
    try {
      await requestCamera();
      toast.success("Câmera liberada para o check-in por QR Code.");
    } catch {
      toast.error("Câmera não liberada. Você pode permitir depois nas configurações do celular.");
    }
  };

  return (
    <div className="glass mb-6 rounded-xl border border-primary/30 p-4 relative">
      <button onClick={dismiss} aria-label="Dispensar" className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
      <p className="font-semibold pr-6">Receba os avisos no celular</p>
      <p className="text-sm text-muted-foreground mt-1">
        Eventos, mensagens, curtidas e comentários chegam como notificação, mesmo com o app fechado.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="neon" disabled={busy} onClick={onNotify}>
          <Bell className="h-4 w-4 mr-1" /> {busy ? "Ativando..." : "Ativar notificações"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCamera}>
          <Camera className="h-4 w-4 mr-1" /> Liberar câmera
        </Button>
      </div>
    </div>
  );
}
