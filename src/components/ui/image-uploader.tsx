import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

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
};

const DEFAULT_MAX_BYTES = 4 * 1024 * 1024; // 4MB
const DEFAULT_ACCEPT = ["image/jpeg", "image/png", "image/webp"];

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
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFile = async (file: File) => {
    const acceptedNames = accept.map((a) => a.split("/")[1]).join(", ").toUpperCase();
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    const limitMB = Math.round(maxBytes / (1024 * 1024));
    if (!accept.includes(file.type)) {
      return toast.error("Formato inválido", {
        description: `Aceitos: ${acceptedNames}. Recebido: ${file.type || "desconhecido"}.`,
      });
    }
    if (file.size > maxBytes) {
      return toast.error("Arquivo grande demais", {
        description: `Limite ${limitMB}MB · arquivo enviado: ${sizeMB}MB.`,
      });
    }
    const toastId = toast.loading("Processando imagem…");
    setUploading(true);
    setProgress(5);
    try {
      let blob: Blob = file;
      let ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      let contentType = file.type;
      if (resizeMax) {
        toast.loading(`Otimizando para ${resizeMax}px…`, { id: toastId });
        const r = await resizeImage(file, resizeMax);
        if (minWidth && r.width < minWidth) {
          setUploading(false);
          toast.error("Imagem pequena demais", { id: toastId, description: `Largura mínima ${minWidth}px · enviada ${r.width}px.` });
          return;
        }
        blob = r.blob;
        ext = r.ext;
        contentType = blob.type;
      }
      setProgress(40);
      toast.loading("Enviando para o servidor…", { id: toastId });
      const path = `${folder}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, blob, {
        cacheControl: "3600",
        upsert: true,
        contentType,
      });
      if (upErr) {
        const msg = upErr.message || "";
        let friendly = msg;
        if (/row-level security|not authorized|policy/i.test(msg)) {
          friendly = "Você não tem permissão para enviar nesta pasta. Contate o admin.";
        } else if (/payload too large|413/.test(msg)) {
          friendly = `Arquivo excede o limite do servidor (${limitMB}MB).`;
        } else if (/mime|content.?type/i.test(msg)) {
          friendly = `Formato não permitido pelo servidor. Aceitos: ${acceptedNames}.`;
        }
        throw new Error(friendly);
      }
      setProgress(95);
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
      setProgress(100);
      toast.success("Imagem enviada", { id: toastId, description: `${(blob.size / 1024).toFixed(0)} KB` });
    } catch (e: any) {
      toast.error("Falha no upload", { id: toastId, description: e?.message ?? "Erro desconhecido" });
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 600);
    }
  };

  return (
    <div>
      {label && <p className="text-sm font-medium mb-2">{label}</p>}
      <div className="flex items-start gap-3">
        <div
          className={`relative shrink-0 rounded-lg border border-border/60 bg-muted/30 overflow-hidden ${
            aspect === "square" ? "w-24 h-24" : aspect === "wide" ? "w-48 h-20" : "w-40 h-24"
          }`}
        >
          {value ? (
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-muted-foreground text-xs">
              Sem imagem
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
            accept={accept.join(",")}
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
            {hint ?? `${accept.map((a) => a.split("/")[1]).join(" · ").toUpperCase()} · máx ${Math.round(maxBytes / (1024 * 1024))}MB${resizeMax ? ` · otimizado para ${resizeMax}px` : ""}`}
          </p>
        </div>
      </div>
    </div>
  );
}