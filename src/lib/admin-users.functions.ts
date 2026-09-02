import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function getAdminClient() {
  const url = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) throw new Error("Servidor sem credenciais Supabase");
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const ROLE_RANK: Record<string, number> = {
  SUPER_ADMIN: 3,
  ADMIN: 2,
  MODERADOR: 1,
  EMBAIXADOR: 1,
  RECRUTADOR: 1,
  MEMBRO: 0,
};

function primaryRole(roles: string[]) {
  if (roles.includes("SUPER_ADMIN")) return "SUPER_ADMIN";
  if (roles.includes("ADMIN")) return "ADMIN";
  if (roles.includes("MODERADOR")) return "MODERADOR";
  if (roles.includes("EMBAIXADOR")) return "EMBAIXADOR";
  if (roles.includes("RECRUTADOR")) return "RECRUTADOR";
  return "MEMBRO";
}

async function getRolesOf(admin: ReturnType<typeof getAdminClient>, userId: string) {
  const { data, error } = await admin.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.role as string);
}

function generateTempPassword() {
  // Senha temporária aleatória, forte e imprevisível — nunca fixa/hardcoded
  const raw = crypto.randomUUID().replace(/-/g, "");
  return `${raw.slice(0, 12)}!Aa1`;
}

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetUserId: string; newPassword?: string }) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        newPassword: z
          .string()
          .min(8, "Mínimo de 8 caracteres")
          .regex(/[A-Z]/, "Precisa de letra maiúscula")
          .regex(/[a-z]/, "Precisa de letra minúscula")
          .regex(/[0-9]/, "Precisa de número")
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {

    const admin = getAdminClient();

    // 1) Papel de quem está chamando, obtido a partir da sessão autenticada (nunca do cliente)
    const callerRoles = await getRolesOf(admin, context.userId);
    const callerRole = primaryRole(callerRoles);

    if (callerRole !== "ADMIN" && callerRole !== "SUPER_ADMIN") {
      throw new Error("Permissão negada.");
    }

    // 2) Bloqueia reset da própria senha por este fluxo administrativo
    if (data.targetUserId === context.userId) {
      throw new Error("Use o fluxo de recuperação de senha para redefinir a própria senha.");
    }

    // 3) Papel do usuário alvo
    const targetRoles = await getRolesOf(admin, data.targetUserId);
    const targetRole = primaryRole(targetRoles);

    // 4) Matriz de permissões: SUPER_ADMIN nunca é resetável por outro admin
    if (targetRole === "SUPER_ADMIN") {
      throw new Error("Senha de SUPER_ADMIN não pode ser resetada por outro administrador.");
    }

    // 5) ADMIN comum não pode resetar outro ADMIN (nem qualquer papel de rank igual/superior)
    if (callerRole === "ADMIN" && ROLE_RANK[targetRole] >= ROLE_RANK["ADMIN"]) {
      throw new Error("ADMIN não pode resetar senha de outro ADMIN.");
    }

    // 6) O admin pode definir a senha diretamente aqui; sem senha informada, gera uma temporária
    const custom = data.newPassword?.trim();
    const finalPassword = custom && custom.length > 0 ? custom : generateTempPassword();
    const isCustom = !!custom;

    const { error } = await admin.auth.admin.updateUserById(data.targetUserId, {
      password: finalPassword,
      user_metadata: { must_change_password: !isCustom },
    });
    if (error) throw new Error(error.message);

    await admin.from("audit_logs").insert({
      user_id: context.userId,
      action: "password_reset",
      entity: "auth.users",
      entity_id: data.targetUserId,
      description: `Senha ${isCustom ? "definida manualmente" : "resetada (temporária)"} por ${callerRole} (${context.userId}) para usuário ${data.targetUserId}`,
    });

    return { ok: true, tempPassword: isCustom ? null : finalPassword, custom: isCustom };

  });

export const listAdminProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("is_admin_or_super", {
      _user_id: context.userId,
    });
    if (roleError || !allowed) throw new Error("Permissão negada.");

    const admin = getAdminClient();
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id,user_id,display_name,email,is_blocked,created_at,is_verified_recruiter,gender,birth_date,address_state,address_region")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const authEmails = new Map<string, string>();
    for (let page = 1; page <= 20; page += 1) {
      const { data, error: usersError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (usersError) throw new Error(usersError.message);
      data.users.forEach((user) => {
        if (user.email) authEmails.set(user.id, user.email);
      });
      if (data.users.length < 200) break;
    }

    return (profiles ?? []).map((profile) => ({
      ...profile,
      email: authEmails.get(profile.user_id) ?? profile.email,
    }));
  });
