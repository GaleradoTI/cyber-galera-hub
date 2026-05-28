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
  aspect?: "square" | "video";
};

const MAX_BYTES = 4 * 1024 * 1024; // 4MB

export function ImageUploader({ bucket, folder, value, onChange, label = "Imagem", aspect = "square" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Selecione uma imagem");
    if (file.size > MAX_BYTES) return toast.error("Tamanho máximo: 4MB");
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });
    setUploading(false);
    if (upErr) return toast.error(upErr.message);
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    onChange(data.publicUrl);
    toast.success("Imagem enviada");
  };

  return (
    <div>
      {label && <p className="text-sm font-medium mb-2">{label}</p>}
      <div className="flex items-start gap-3">
        <div
          className={`relative shrink-0 rounded-lg border border-border/60 bg-muted/30 overflow-hidden ${
            aspect === "square" ? "w-24 h-24" : "w-40 h-24"
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
            accept="image/*"
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
          <p className="text-[10px] text-muted-foreground">JPG/PNG até 4MB</p>
        </div>
      </div>
    </div>
  );
}