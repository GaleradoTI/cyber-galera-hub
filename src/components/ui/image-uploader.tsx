import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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

  const handleFile = async (file: File) => {
    if (!accept.includes(file.type)) {
      return toast.error(`Formato inválido. Aceitos: ${accept.map((a) => a.split("/")[1]).join(", ").toUpperCase()}`);
    }
    if (file.size > maxBytes) {
      return toast.error(`Tamanho máximo: ${Math.round(maxBytes / (1024 * 1024))}MB`);
    }
    setUploading(true);
    try {
      let blob: Blob = file;
      let ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      let contentType = file.type;
      if (resizeMax) {
        const r = await resizeImage(file, resizeMax);
        if (minWidth && r.width < minWidth) {
          setUploading(false);
          return toast.error(`Largura mínima ${minWidth}px. A imagem enviada tem ${r.width}px.`);
        }
        blob = r.blob;
        ext = r.ext;
        contentType = blob.type;
      }
      const path = `${folder}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, blob, {
        cacheControl: "3600",
        upsert: true,
        contentType,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Imagem enviada");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload");
    } finally {
      setUploading(false);
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
          {value && (
            <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => onChange(null)}>
              <X className="h-3 w-3 mr-1" /> Remover
            </Button>
          )}
          <p className="text-[10px] text-muted-foreground">
            {hint ?? `JPG/PNG/WebP até ${Math.round(maxBytes / (1024 * 1024))}MB${resizeMax ? ` · otimizado para ${resizeMax}px` : ""}`}
          </p>
        </div>
      </div>
    </div>
  );
}