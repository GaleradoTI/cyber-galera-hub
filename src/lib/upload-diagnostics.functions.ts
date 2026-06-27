import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type UploadDiagnostic = {
  bucket?: string;
  bucket_public?: boolean;
  prefix?: string;
  first_folder?: string;
  expected_path?: string;
  required_role?: string;
  current_user_id?: string;
  current_user_roles?: string[];
  current_user_is_admin?: boolean;
  can_insert_probe?: boolean;
  policies?: Array<{
    name?: string;
    command?: string;
    roles?: string[];
    using?: string | null;
    with_check?: string | null;
  }>;
};

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
    return (diagnostic ?? {}) as UploadDiagnostic;
  });