import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, X, Loader2, Info, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getStorageUploadDiagnostics } from "@/lib/upload-diagnostics.functions";

type Props = {
  bucket: "avatars" | "project-covers";
  folder: string; // user_id or project_id
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  aspect?: "square" | "video" | "wide";
  /** Max bytes accepted from the user before any resize (default 4MB). */
  maxBytes?: number;
  /** Allowed MIME types (default JPG/PNG/WebP). */
  accept?: string[];
  /** When set, the image is resized client-side so the largest edge ≤ this many px. */
  resizeMax?: number;
  /** Minimum width required after resize (rejects tiny images). */
  minWidth?: number;
  /** Helper text shown under the buttons. */
  hint?: string;
  /** Key in upload_policy (public_site_settings) used to override defaults at runtime. */
  policyKey?: "avatars" | "project_covers" | "event_banners" | "drop_images" | "favicon" | "documents";
  /** Record every attempt (success/failure) of this upload in audit_logs (used for drops). */
  auditEntity?: "drop_image" | "community_profile_photo" | "mascot_image" | "site_asset";
  /** Optional entity id passed to the audit log (e.g. drop id). */
  auditEntityId?: string | null;
  /** When true, shows a small "i" button with bucket/path/policy diagnostics (admin only). */
  showDiagnostics?: boolean;
  /** How the preview image should fit inside its box. */
  imageFit?: "cover" | "contain";
  /** Renders only a compact icon button (X/Twitter-style composer actions). */
  compact?: boolean;
  /** Accessible label for the compact button. */
  compactLabel?: string;
};

const DEFAULT_MAX_BYTES = 4 * 1024 * 1024; // 4MB
const DEFAULT_ACCEPT = ["image/jpeg", "image/png", "image/webp"];

function useUploadPolicy() {
  return useQuery({
    queryKey: ["upload-policy"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("public_site_settings")
        .select("setting_value")
        .eq("setting_key", "upload_policy")
        .maybeSingle();
      return (data?.setting_value ?? null) as null | Record<string, { max_mb?: number; accept?: string[]; resize_max?: number }>;
    },
  });
}

async function resizeImage(file: File, maxEdge: number): Promise<{ blob: Blob; width: number; height: number; ext: string }> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img: HTMLImageElement = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  let { width, height } = img;
  const longest = Math.max(width, height);
  if (longest > maxEdge) {
    const ratio = maxEdge / longest;
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(img, 0, 0, width, height);
  const mime = file.type === "image/png" ? "image/png" : "image/webp";
  const ext = mime === "image/png" ? "png" : "webp";
  const blob: Blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Falha ao gerar imagem"))), mime, 0.86)!,
  );
  return { blob, width, height, ext };
}

export function ImageUploader({
  bucket, folder, value, onChange, label = "Imagem", aspect = "square",
  maxBytes = DEFAULT_MAX_BYTES, accept = DEFAULT_ACCEPT, resizeMax, minWidth, hint,
  policyKey, auditEntity, auditEntityId, showDiagnostics, imageFit = "cover",
  compact = false, compactLabel = "Adicionar imagem",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewFailed, setPreviewFailed] = useState(false);
  const { data: policy } = useUploadPolicy();
  const normalizedFolder = useMemo(() => folder.replace(/^\/+|\/+$/g, ""), [folder]);

  useEffect(() => {
    setPreviewFailed(false);
  }, [value]);

  // Resolve effective accept/maxBytes from upload_policy when policyKey is provided.
  const effective = useMemo(() => {
    const ctx = policyKey ? policy?.[policyKey] : undefined;
    const fallback = policy?.defaults as { max_mb?: number; accept?: string[]; resize_max?: number } | undefined;
    const finalAccept = ctx?.accept ?? fallback?.accept ?? accept;
    const finalMaxMb = ctx?.max_mb ?? fallback?.max_mb;
    const finalMaxBytes = finalMaxMb ? Math.round(finalMaxMb * 1024 * 1024) : maxBytes;
    const finalResize = resizeMax ?? ctx?.resize_max ?? fallback?.resize_max;
    return { accept: finalAccept, maxBytes: finalMaxBytes, resizeMax: finalResize };
  }, [policy, policyKey, accept, maxBytes, resizeMax]);

  const recordAttempt = async (
    status: "success" | "failed",
    path: string,
    reason: string | null,
    file?: { name?: string; type?: string; size?: number },
  ) => {
    if (!auditEntity) return;
    try {
      if (auditEntity === "drop_image") {
        await (supabase as any).rpc("log_drop_image_upload_attempt", {
          _drop_id: auditEntityId ?? null,
          _bucket: bucket,
          _path: path,
          _status: status,
          _reason: reason,
          _file_name: file?.name ?? null,
          _file_type: file?.type ?? null,
          _file_size: file?.size ?? null,
        });
      } else {
        await (supabase as any).rpc("log_image_upload_attempt", {
          _context: auditEntity,
          _bucket: bucket,
          _path: path,
          _status: status,
          _reason: reason,
          _file_name: file?.name ?? null,
          _file_type: file?.type ?? null,
          _file_size: file?.size ?? null,
        });
      }
    } catch {
      /* logging is best-effort */
    }
  };

  const handleFile = async (file: File) => {
    const accept = effective.accept;
    const maxBytes = effective.maxBytes;
    const resizeMax = effective.resizeMax;
    const acceptedNames = accept.map((a) => a.split("/")[1]).join(", ").toUpperCase();
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    const limitMB = Math.round(maxBytes / (1024 * 1024));
    // Ensure we have an active session — Storage RLS depends on auth.uid()
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      await supabase.auth.refreshSession();
      const { data: again } = await supabase.auth.getSession();
      if (!again.session) {
        await recordAttempt("failed", `${normalizedFolder}/<rejected>`, "Sessão expirada", file);
        return toast.error("Sessão expirada", {
          description: "Faça login novamente para enviar imagens.",
        });
      }
    }
    if (!accept.includes(file.type)) {
      await recordAttempt("failed", `${normalizedFolder}/<rejected>`, `Tipo não aceito: ${file.type}`, file);
      return toast.error("Formato inválido", {
        description: `Aceitos: ${acceptedNames}. Recebido: ${file.type || "desconhecido"}.`,
      });
    }
    if (file.size > maxBytes) {
      await recordAttempt("failed", `${normalizedFolder}/<rejected>`, `Arquivo ${sizeMB}MB excede limite ${limitMB}MB`, file);
      return toast.error("Arquivo grande demais", {
        description: `Limite ${limitMB}MB · arquivo enviado: ${sizeMB}MB.`,
      });
    }
    const toastId = toast.loading("Processando imagem…");
    setUploading(true);
    setProgress(5);
    let path = "";
    try {
      let blob: Blob = file;
      let ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      let contentType = file.type;
      if (resizeMax) {
        toast.loading(`Otimizando para ${resizeMax}px…`, { id: toastId });
        const r = await resizeImage(file, resizeMax);
        if (minWidth && r.width < minWidth) {
          setUploading(false);
          await recordAttempt("failed", `${normalizedFolder}/<rejected>`, `Imagem ${r.width}px < mínimo ${minWidth}px`, file);
          toast.error("Imagem pequena demais", { id: toastId, description: `Largura mínima ${minWidth}px · enviada ${r.width}px.` });
          return;
        }
        blob = r.blob;
        ext = r.ext;
        contentType = blob.type;
      }
      setProgress(40);
      toast.loading("Enviando para o servidor…", { id: toastId });
      path = `${normalizedFolder}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, blob, {
        cacheControl: "3600",
        upsert: true,
        contentType,
      });
      if (upErr) {
        const msg = upErr.message || "";
        const errorName = (upErr as any)?.name ? `${(upErr as any).name}: ` : "";
        const statusCode = (upErr as any)?.statusCode ?? (upErr as any)?.status ?? "";
        const technical = `${errorName}${msg}${statusCode ? ` (status ${statusCode})` : ""}`;
        let friendly = msg;
        let isRls = false;
        let isAuth = false;
        if (/jwt|invalid.*token|aud claim|not authenticated/i.test(msg)) {
          friendly = `Sessão inválida. Saia e entre novamente para reenviar a imagem. Detalhe: ${technical}`;
          isAuth = true;
        } else if (
          String(statusCode) === "403" ||
          String(statusCode) === "400" ||
          /row-level security|not authorized|unauthorized|policy/i.test(msg)
        ) {
          friendly =
            `🔒 Permissão negada ao enviar em ${bucket}/${path}. ` +
            `Verifique se a sessão está ativa e se seu cargo permite este prefixo. ` +
            `Abra o Diagnóstico para conferir bucket, pasta e policy aplicada. ` +
            `Detalhe: ${technical}`;
          isRls = true;
        } else if (/payload too large|413/.test(msg)) {
          friendly = `Arquivo excede o limite do servidor (${limitMB}MB).`;
        } else if (/mime|content.?type/i.test(msg)) {
          friendly = `Formato não permitido pelo servidor. Aceitos: ${acceptedNames}.`;
        }
        await recordAttempt("failed", path, friendly, file);
        const err = new Error(friendly) as Error & { _kind?: string };
        err._kind = isAuth ? "auth" : isRls ? "rls" : "generic";
        throw err;
      }
      setProgress(95);
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
      setProgress(100);
      await recordAttempt("success", path, null, { name: file.name, type: file.type, size: blob.size });
      toast.success("Imagem enviada", { id: toastId, description: `${(blob.size / 1024).toFixed(0)} KB` });
    } catch (e: any) {
      const kind = e?._kind as string | undefined;
      const action =
        kind === "auth"
          ? {
              label: "Reabrir sessão",
              onClick: async () => {
                await supabase.auth.refreshSession();
                toast.info("Sessão atualizada", { description: "Tente o envio novamente." });
              },
            }
          : kind === "rls"
          ? {
              label: "Como corrigir",
              onClick: () =>
                toast.message("Permissão negada (RLS)", {
                  description:
                    `Bucket: ${bucket} · Pasta: ${normalizedFolder}\n` +
                    `• Avatars: apenas o dono da pasta (user.id) pode enviar.\n` +
                    `• project-covers/drops e /site: apenas ADMIN ou SUPER_ADMIN.\n` +
                    `• project-covers/events: usuário autenticado.\n` +
                    `Abra o botão "Diagnóstico" para ver as policies aplicadas.`,
                  duration: 12000,
                }),
            }
          : undefined;
      toast.error("Falha no upload", {
        id: toastId,
        description: e?.message ?? "Erro desconhecido",
        duration: 10000,
        action,
      });
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 600);
    }
  };

  if (compact) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept={effective.accept.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9 rounded-full text-primary hover:bg-primary/10"
          aria-label={compactLabel}
          title={compactLabel}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
        </Button>
      </>
    );
  }

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">{label}</p>
          {showDiagnostics && <DiagnosticsPopover bucket={bucket} folder={normalizedFolder} effective={effective} policyKey={policyKey} />}
        </div>
      )}
      <div className="flex items-start gap-3">
        <div
          className={`relative shrink-0 rounded-lg border border-border/60 bg-muted/30 overflow-hidden ${
            aspect === "square" ? "w-24 h-24" : aspect === "wide" ? "w-48 h-20" : "w-40 h-24"
          }`}
        >
          {value && !previewFailed ? (
            <img
              src={value}
              alt="Prévia da imagem enviada"
              className={`w-full h-full ${imageFit === "contain" ? "object-contain p-2" : "object-cover"}`}
              onError={() => setPreviewFailed(true)}
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-muted-foreground text-xs text-center px-2">
              {value ? "Imagem indisponível" : "Sem imagem"}
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={effective.accept.join(",")}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
            <Upload className="h-3 w-3 mr-1" /> Enviar
          </Button>
          {uploading && progress > 0 && (
            <div className="w-32">
              <Progress value={progress} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground mt-0.5">{progress}%</p>
            </div>
          )}
          {value && (
            <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => onChange(null)}>
              <X className="h-3 w-3 mr-1" /> Remover
            </Button>
          )}
          <p className="text-[10px] text-muted-foreground leading-tight">
            {hint ?? `${effective.accept.map((a) => a.split("/")[1]).join(" · ").toUpperCase()} · máx ${Math.round(effective.maxBytes / (1024 * 1024))}MB${effective.resizeMax ? ` · otimizado para ${effective.resizeMax}px` : ""}`}
          </p>
        </div>
      </div>
    </div>
  );
}

function DiagnosticsPopover({
  bucket,
  folder,
  effective,
  policyKey,
}: {
  bucket: string;
  folder: string;
  effective: { accept: string[]; maxBytes: number; resizeMax?: number };
  policyKey?: string;
}) {
  const loadDiagnostics = useServerFn(getStorageUploadDiagnostics);
  const { data: diagnostics, isFetching, error, refetch } = useQuery({
    queryKey: ["storage-upload-diagnostics", bucket, folder],
    enabled: false,
    queryFn: () => loadDiagnostics({ data: { bucket: bucket as "avatars" | "project-covers", prefix: folder } }),
  });
  const info = diagnostics as any;
  const policies = Array.isArray(info?.policies) ? info.policies : [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => refetch()}>
          <Info className="h-3 w-3 mr-1" /> Diagnóstico
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs space-y-2">
        <div className="font-bold text-sm">Configuração ativa</div>
        <Row k="Bucket" v={bucket} />
        {info && <Row k="Bucket público" v={info.bucket_public ? "sim" : "não"} />}
        <Row k="Prefixo (pasta)" v={folder} />
        <Row k="Caminho final" v={`${bucket}/${folder}/<timestamp>.<ext>`} mono />
        <Row k="Policy key" v={policyKey ?? "(usa default)"} />
        {info?.current_user_roles && <Row k="Cargo atual" v={Array.isArray(info.current_user_roles) ? info.current_user_roles.join(", ") : String(info.current_user_roles)} />}
        {info && <Row k="Permissão teste" v={info.can_insert_probe ? "liberada" : "bloqueada"} />}
        <Row k="Tipos aceitos" v={effective.accept.join(", ")} />
        <Row k="Tamanho máx" v={`${Math.round(effective.maxBytes / (1024 * 1024))} MB`} />
        {effective.resizeMax && <Row k="Resize" v={`${effective.resizeMax}px`} />}
        <div className="pt-2 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground leading-snug">
            RLS: a permissão é calculada por bucket e prefixo. Para <code>project-covers/site/*</code> e
            <code> project-covers/drops/*</code>, somente <strong>ADMIN / SUPER_ADMIN</strong>; para <code>avatars/*</code>, somente o dono da pasta.
            Mudanças no tamanho/tipo são em
            <code> /dashboard/upload-config</code>.
          </p>
        </div>
        <div className="pt-2 border-t border-border/30 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <strong>Policy RLS aplicada</strong>
            {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
          {error && <p className="text-destructive">{(error as Error).message}</p>}
          {!error && !isFetching && policies.length === 0 && (
            <p className="text-muted-foreground">Abra o diagnóstico para consultar as policies do Storage.</p>
          )}
          {policies.slice(0, 3).map((policy: any) => (
            <div key={`${policy.name}-${policy.command}`} className="rounded-md bg-muted/20 p-2 space-y-1">
              <div className="font-semibold">{policy.name} · {policy.command}</div>
              <div className="break-all"><span className="text-muted-foreground">WITH CHECK:</span> {policy.with_check ?? "—"}</div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 w-24 pt-0.5">{k}</div>
      <div className={`flex-1 ${mono ? "font-mono text-[11px]" : "text-xs"} break-all`}>{v}</div>
    </div>
  );
}