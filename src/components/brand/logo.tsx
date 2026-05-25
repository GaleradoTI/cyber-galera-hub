import { Link } from "@tanstack/react-router";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className = "", showText = true }: LogoProps) {
  return (
    <Link to="/" className={`flex items-center gap-3 group ${className}`}>
      <div className="relative">
        <div className="h-10 w-10 rounded-xl bg-gradient-neon flex items-center justify-center font-black text-background text-base shadow-[0_0_20px_oklch(0.65_0.30_0/0.5)] group-hover:shadow-[0_0_30px_oklch(0.65_0.30_0/0.8)] transition-shadow">
          {"</>"}
        </div>
        <div className="absolute inset-0 rounded-xl bg-gradient-neon opacity-40 blur-lg -z-10 group-hover:opacity-70 transition-opacity" />
      </div>
      {showText && (
        <div className="leading-none">
          <div className="font-black tracking-tight text-base text-foreground">GALERA</div>
          <div className="text-[10px] font-bold tracking-[0.3em] text-gradient-neon">DO T.I.</div>
        </div>
      )}
    </Link>
  );
}