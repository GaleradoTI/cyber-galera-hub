import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const emailSchema = z.string().trim().toLowerCase().email();
const codeSchema = z.string().regex(/^\d{6}$/);
const passwordSchema = z
  .string()
  .min(8)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/);

const genericRequestMessage =
  "Se o email estiver cadastrado, enviaremos um código de 6 dígitos.";

async function findAuthUserByEmail(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("Não foi possível consultar a conta.");
    const user = data.users.find((item) => item.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function hmac(value: string) {
  const pepper = process.env['PASSWORD_RESET_CODE_PEPPER'];
  if (!pepper) throw new Error("Serviço de recuperação não configurado.");
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", pepper).update(value).digest("hex");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function requestMetadata() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwarded ?? request.headers.get("cf-connecting-ip") ?? null,
    userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
  };
}

const FALLBACK_FROM = "GALERA DO T.I. <onboarding@resend.dev>";

async function postRecoveryEmail(from: string, email: string, code: string, keys: { lovableKey: string; resendKey: string }) {
  return fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${keys.lovableKey}`,
      "X-Connection-Api-Key": keys.resendKey,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `${code} é seu código de recuperação`,
      text: `Seu código para redefinir a senha é ${code}. Ele expira em 10 minutos. Se você não fez esta solicitação, ignore este email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#111827"><h1 style="font-size:24px;margin:0 0 16px">Redefinição de senha</h1><p>Use o código abaixo para continuar:</p><p style="font-size:34px;font-weight:800;letter-spacing:8px;margin:28px 0">${code}</p><p>O código expira em 10 minutos e só pode ser usado uma vez.</p><p style="color:#6b7280;font-size:14px">Se você não fez esta solicitação, ignore este email.</p></div>`,
    }),
  });
}

async function sendRecoveryCode(email: string, code: string) {
  const lovableKey = process.env['LOVABLE_API_KEY'];
  const resendKey = process.env['RESEND_API_KEY'];
  if (!lovableKey || !resendKey) throw new Error("Serviço de email não configurado.");
  const keys = { lovableKey, resendKey };

  const primaryFrom = process.env['PASSWORD_RESET_FROM_EMAIL'] ?? "GALERA DO T.I. <contato@galeradoti.com>";
  let response = await postRecoveryEmail(primaryFrom, email, code, keys);

  if (!response.ok) {
    const body = await response.text();
    console.error(`[Password reset] Resend failed [${response.status}] from=${primaryFrom}: ${body}`);
    const domainUnverified = response.status === 403 && /not verified/i.test(body);
    if (!domainUnverified) throw new Error("O serviço de email está temporariamente indisponível.");

    // Domínio próprio ainda sem DNS validado: tenta o remetente compartilhado do Resend.
    response = await postRecoveryEmail(FALLBACK_FROM, email, code, keys);
    if (!response.ok) {
      const fallbackBody = await response.text();
      console.error(`[Password reset] Resend fallback failed [${response.status}]: ${fallbackBody}`);
      throw new Error(
        "Não foi possível enviar o código: o domínio de email da comunidade ainda não foi verificado no Resend. Um administrador precisa concluir a verificação de DNS.",
      );
    }
  }
}


export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) =>
    z.object({ email: emailSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = await findAuthUserByEmail(data.email);
    if (!user) return { ok: true, message: genericRequestMessage };

    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count, error: countError } = await supabaseAdmin
      .from("password_reset_codes")
      .select("id", { count: "exact", head: true })
      .eq("email", data.email)
      .gte("created_at", since);
    if (countError) throw new Error("Não foi possível iniciar a recuperação.");
    if ((count ?? 0) >= 3) return { ok: true, message: genericRequestMessage };

    const { randomInt } = await import("node:crypto");
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const metadata = await requestMetadata();
    const { error: invalidateError } = await supabaseAdmin
      .from("password_reset_codes")
      .update({ completed_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("completed_at", null);
    if (invalidateError) throw new Error("Não foi possível iniciar a recuperação.");

    const { data: reset, error: insertError } = await supabaseAdmin
      .from("password_reset_codes")
      .insert({
        user_id: user.id,
        email: data.email,
        code_hash: await hmac(`${user.id}:${code}`),
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        request_ip: metadata.ip,
        request_user_agent: metadata.userAgent,
      })
      .select("id")
      .single();
    if (insertError) throw new Error("Não foi possível iniciar a recuperação.");

    try {
      await sendRecoveryCode(data.email, code);
    } catch (error) {
      await supabaseAdmin
        .from("password_reset_codes")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", reset.id);
      throw error;
    }
    return { ok: true, message: genericRequestMessage };
  });

export const verifyPasswordResetCode = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; code: string }) =>
    z.object({ email: emailSchema, code: codeSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reset, error } = await supabaseAdmin
      .from("password_reset_codes")
      .select("id,user_id,code_hash,attempts,max_attempts,expires_at")
      .eq("email", data.email)
      .is("completed_at", null)
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Não foi possível verificar o código.");
    const invalid = !reset || reset.attempts >= reset.max_attempts || new Date(reset.expires_at).getTime() <= Date.now();
    if (invalid) throw new Error("Código inválido ou expirado.");

    const candidate = await hmac(`${reset.user_id}:${data.code}`);
    const matches = constantTimeEqual(candidate, reset.code_hash);
    if (!matches) {
      await supabaseAdmin
        .from("password_reset_codes")
        .update({ attempts: reset.attempts + 1 })
        .eq("id", reset.id);
      throw new Error("Código inválido ou expirado.");
    }

    const { randomBytes } = await import("node:crypto");
    const ticket = randomBytes(32).toString("base64url");
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("password_reset_codes")
      .update({
        attempts: reset.attempts + 1,
        verified_at: now,
        ticket_hash: await hmac(`${reset.id}:${ticket}`),
        ticket_expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      })
      .eq("id", reset.id);
    if (updateError) throw new Error("Não foi possível verificar o código.");
    return { ticket };
  });

export const completePasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; ticket: string; password: string }) =>
    z.object({ email: emailSchema, ticket: z.string().min(32).max(200), password: passwordSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reset, error } = await supabaseAdmin
      .from("password_reset_codes")
      .select("id,user_id,ticket_hash,ticket_expires_at")
      .eq("email", data.email)
      .is("completed_at", null)
      .not("verified_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const invalid =
      error ||
      !reset ||
      !reset.ticket_hash ||
      !reset.ticket_expires_at ||
      new Date(reset.ticket_expires_at).getTime() <= Date.now() ||
      !constantTimeEqual(await hmac(`${reset.id}:${data.ticket}`), reset.ticket_hash);
    if (invalid || !reset) throw new Error("Verificação expirada. Solicite um novo código.");

    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(reset.user_id, {
      password: data.password,
    });
    if (passwordError) throw new Error("Não foi possível atualizar a senha.");
    const { error: completeError } = await supabaseAdmin
      .from("password_reset_codes")
      .update({ completed_at: new Date().toISOString(), ticket_hash: null })
      .eq("id", reset.id);
    if (completeError) console.error(`[Password reset] Completion log failed: ${completeError.message}`);

    await supabaseAdmin.from("audit_logs").insert({
      user_id: reset.user_id,
      action: "PASSWORD_RESET_COMPLETED",
      entity: "auth.users",
      entity_id: reset.user_id,
      description: "Senha redefinida pelo fluxo de código de verificação.",
    });
    return { ok: true };
  });