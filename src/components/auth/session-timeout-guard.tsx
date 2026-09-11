import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, signOut } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Inatividade tolerada antes de perguntar se a pessoa continua por aqui.
const IDLE_LIMIT_MS = 60 * 60 * 1000; // 60 min
const CONFIRM_WINDOW_S = 120; // 2 min para confirmar

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "focus"] as const;

export function SessionTimeoutGuard() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  const [left, setLeft] = useState(CONFIRM_WINDOW_S);
  const lastActive = useRef(Date.now());

  const endSession = useCallback(async () => {
    setAsking(false);
    await signOut();
    navigate({ to: "/login" });
  }, [navigate]);

  const stayConnected = useCallback(async () => {
    lastActive.current = Date.now();
    setAsking(false);
    setLeft(CONFIRM_WINDOW_S);
    await supabase.auth.refreshSession().catch(() => undefined);
  }, []);

  // Marca atividade do usuário.
  useEffect(() => {
    if (!isAuthenticated) return;
    const mark = () => {
      if (!asking) lastActive.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, mark));
  }, [isAuthenticated, asking]);

  // Verifica inatividade.
  useEffect(() => {
    if (!isAuthenticated) {
      setAsking(false);
      return;
    }
    const id = window.setInterval(() => {
      if (!asking && Date.now() - lastActive.current >= IDLE_LIMIT_MS) {
        setLeft(CONFIRM_WINDOW_S);
        setAsking(true);
      }
    }, 30_000);
    return () => window.clearInterval(id);
  }, [isAuthenticated, asking]);

  // Contagem regressiva da confirmação.
  useEffect(() => {
    if (!asking) return;
    const id = window.setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          window.clearInterval(id);
          void endSession();
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [asking, endSession]);

  if (!isAuthenticated) return null;

  return (
    <AlertDialog open={asking}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Você ainda está por aí?</AlertDialogTitle>
          <AlertDialogDescription>
            Sua sessão está parada há um tempo. Confirme para continuar conectado — caso contrário,
            vamos encerrar em {left}s por segurança.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => void endSession()}>Sair agora</AlertDialogCancel>
          <AlertDialogAction onClick={() => void stayConnected()}>Continuar conectado</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
