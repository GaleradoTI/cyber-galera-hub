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

async function assertAdmin(supabase: ReturnType<typeof getAdminClient>, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r) => r.role as string);
  if (!roles.includes("ADMIN") && !roles.includes("SUPER_ADMIN")) {
    throw new Error("Permissão negada");
  }
  return roles;
}

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetUserId: string; newPassword?: string }) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        newPassword: z.string().min(8).max(72).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = getAdminClient();
    await assertAdmin(admin, context.userId);

    // Pega senha padrão das configurações se nada vier
    let password = data.newPassword;
    if (!password) {
      const { data: setting } = await admin
        .from("public_site_settings")
        .select("setting_value")
        .eq("setting_key", "password_policy")
        .maybeSingle();
      const policy = (setting?.setting_value ?? {}) as { default_reset_password?: string };
      password = policy.default_reset_password || "GaleraTI@2026";
    }

    const { error } = await admin.auth.admin.updateUserById(data.targetUserId, {
      password,
    });
    if (error) throw new Error(error.message);

    await admin.from("audit_logs").insert({
      user_id: context.userId,
      action: "password_reset",
      entity: "auth.users",
      entity_id: data.targetUserId,
      description: `Senha resetada por admin`,
    });

    return { ok: true, password };
  });