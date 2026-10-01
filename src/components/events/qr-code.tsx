import { useEffect, useState } from "react";

export function QrCode({ value, size = 200, className }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    import("qrcode").then((QR) =>
      QR.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: "M" }).then((url) => alive && setSrc(url)),
    );
    return () => { alive = false; };
  }, [value, size]);
  return (
    <div className={`bg-card p-2 rounded-lg inline-block ${className ?? ""}`} style={{ width: size + 16, height: size + 16 }}>
      {src ? <img src={src} alt={`QR Code ${value}`} width={size} height={size} /> : <div className="w-full h-full animate-pulse bg-muted rounded" />}
    </div>
  );
}
