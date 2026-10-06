import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { buildPushHTTPRequest } from "@pushforge/builder";

const Body = z.object({ notification_id: z.string().uuid() });

// Chamado pelo banco a cada novo aviso. Não confia no conteúdo enviado:
// busca o aviso pelo id, só envia se for recente e ainda não enviado.
export const Route = createFileRoute("/api/public/push/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("bad request", { status: 400 });
        const jwkRaw = process.env.VAPID_PRIVATE_JWK;
        if (!jwkRaw) return new Response("not configured", { status: 500 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const since = new Date(Date.now() - 5 * 60_000).toISOString();
        const { data: n } = await supabaseAdmin
          .from("notifications")
          .update({ pushed_at: new Date().toISOString() })
          .eq("id", parsed.data.notification_id)
          .is("pushed_at", null)
          .gte("created_at", since)
          .select("id,user_id,title,body,link")
          .maybeSingle();
        if (!n) return new Response("skip");

        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id,endpoint,p256dh,auth")
          .eq("user_id", n.user_id);

        const privateJWK = JSON.parse(jwkRaw);
        await Promise.all(
          (subs ?? []).map(async (s) => {
            try {
              const req = await buildPushHTTPRequest({
                privateJWK,
                subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                message: {
                  payload: { id: n.id, title: n.title, body: n.body ?? "", link: n.link ?? "/dashboard" },
                  adminContact: "mailto:contato@galeradoti.com",
                },
              });
              const res = await fetch(req.endpoint, { method: "POST", headers: req.headers, body: req.body });
              if (res.status === 404 || res.status === 410) {
                await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
              }
            } catch (e) {
              console.error("push failed", e);
            }
          }),
        );
        return new Response("ok");
      },
    },
  },
});
