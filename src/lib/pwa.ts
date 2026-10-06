import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY =
  "BAMknBnnOp_m4IbZMebbkgzxoN9hMf3kGzGiBcMcNH_sBkC9nOqIS3itJedrvFatowjDoIJRzsQfXySSb-A4KX4";

export function isStandaloneApp() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function getRegistration() {
  return (
    (await navigator.serviceWorker.getRegistration("/push-sw.js")) ??
    (await navigator.serviceWorker.register("/push-sw.js", { scope: "/" }))
  );
}

/** Pede permissão e registra este aparelho para receber os avisos. */
export async function enablePush(userId: string) {
  if (!pushSupported()) throw new Error("Este navegador não suporta notificações. No iPhone, instale o app na tela inicial primeiro.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Permissão de notificação negada. Libere nas configurações do celular.");
  const reg = await getRegistration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY) }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
}

export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}

export async function pushEnabledHere() {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
  return !!(await reg?.pushManager.getSubscription());
}

/** Pede acesso à câmera (usado no check-in por QR Code). */
export async function requestCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  stream.getTracks().forEach((t) => t.stop());
}
