import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getStorageUploadDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bucket: string; prefix: string }) =>
    z
      .object({
        bucket: z.enum(["avatars", "project-covers"]),
        prefix: z.string().trim().min(1).max(180),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: diagnostic, error } = await context.supabase.rpc("get_storage_upload_diagnostics" as never, {
      _bucket: data.bucket,
      _prefix: data.prefix,
    } as never);

    if (error) throw new Error(error.message);
    return diagnostic as unknown;
  });