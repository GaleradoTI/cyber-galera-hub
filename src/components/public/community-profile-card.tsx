import { useState, useEffect } from "react";
import { ExternalLink, ArrowRight, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export type CommunityProfile = {
  id: string;
  name: string;
  role_title: string | null;
  photo_url: string | null;
  professional_story: string | null;
  community_role: string | null;
  social_links: { label?: string; url?: string }[] | Record<string, string>;
};

function normalizeLinks(value: CommunityProfile["social_links"]) {
  if (Array.isArray(value)) return value;
  return Object.entries(value ?? {}).map(([label, url]) => ({ label, url }));
}

export function CommunityProfileCard({ profile }: { profile: CommunityProfile }) {
  const [open, setOpen] = useState(false);
  const links = normalizeLinks(profile.social_links).filter((l) => l.url);

  // Injeta JSON-LD (schema.org/Person) dinâmico enquanto o modal está aberto para SEO.
  useEffect(() => {
    if (!open) return;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.communityProfile = profile.id;
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Person",
      name: profile.name,
      jobTitle: profile.role_title || undefined,
      description: profile.professional_story || profile.community_role || undefined,
      image: profile.photo_url || undefined,
      sameAs: links.map((l) => l.url).filter(Boolean),
    });
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, [open, profile, links]);

  const track = (event: string, extra: Record<string, unknown> = {}) => {
    try {
      const payload = { event, profile_id: profile.id, profile_name: profile.name, ...extra };
      (window as any).dataLayer?.push?.(payload);
      window.dispatchEvent(new CustomEvent("community-profile-analytics", { detail: payload }));
      if (import.meta.env.DEV) console.debug("[analytics]", payload);
    } catch {}
  };

  const isValidUrl = (raw?: string) => {
    if (!raw) return false;
    try {
      const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch { return false; }
  };

  return (
    <>
      <article className="glass rounded-xl border border-primary/20 p-5 hover-glow-cyan flex flex-col h-full">
        <div className="flex flex-col items-center text-center gap-3">
          <Avatar className="h-20 w-20 border border-secondary/30">
            <AvatarImage src={profile.photo_url ?? undefined} alt={profile.name} className="object-cover" />
            <AvatarFallback>{profile.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 w-full">
            <h2 className="font-black text-base leading-tight truncate">{profile.name}</h2>
            {profile.role_title && (
              <p className="text-xs text-secondary mt-1 line-clamp-2">{profile.role_title}</p>
            )}
          </div>
          {links.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {links.slice(0, 4).map((l) =>
                isValidUrl(l.url) ? (
                  <a
                    key={`${l.label}-${l.url}`}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => track("community_profile_primary_link_click", { url: l.url, label: l.label })}
                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition px-2 py-0.5 rounded border border-border/30"
                  >
                    {l.label || "Link"} <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                ) : null,
              )}
            </div>
          )}
        </div>

        <div className="mt-auto pt-4">
          <button
            type="button"
            onClick={() => { track("community_profile_open"); setOpen(true); }}
            className="w-full inline-flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition py-1.5"
          >
            Saiba mais <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </article>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) track("community_profile_close"); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4">
              <Avatar className="h-20 w-20 shrink-0 border border-secondary/40">
                <AvatarImage src={profile.photo_url ?? undefined} alt={profile.name} className="object-cover" />
                <AvatarFallback>{profile.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <DialogTitle className="text-xl font-black leading-tight break-words">{profile.name}</DialogTitle>
                {profile.role_title && (
                  <DialogDescription className="text-secondary mt-1">{profile.role_title}</DialogDescription>
                )}
                {profile.community_role && (
                  <Badge variant="outline" className="mt-2 text-[10px]">{profile.community_role}</Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {profile.professional_story && (
              <div>
                <p className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground/70 mb-2">HISTÓRIA PROFISSIONAL</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {profile.professional_story}
                </p>
              </div>
            )}

            {profile.community_role && profile.professional_story && <Separator />}

            {profile.community_role && (
              <div>
                <p className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground/70 mb-2">O QUE FAZ NA COMUNIDADE</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{profile.community_role}</p>
              </div>
            )}

            {links.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground/70 mb-2">LINKS</p>
                  <div className="flex flex-wrap gap-2">
                    {links.map((link) => {
                      const valid = isValidUrl(link.url);
                      if (!valid) {
                        return (
                          <span
                            key={`${link.label}-${link.url}`}
                            title="Link inválido — verifique com o administrador"
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-destructive/40 text-destructive/80 opacity-70 cursor-not-allowed"
                          >
                            <AlertTriangle className="h-3 w-3" /> {link.label || "Link"} indisponível
                          </span>
                        );
                      }
                      return (
                        <a
                          key={`${link.label}-${link.url}`}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => track("community_profile_link_click", { url: link.url, label: link.label })}
                          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border/40 hover:border-primary/50 hover:text-primary transition"
                        >
                          {link.label || "Link"} <ExternalLink className="h-3 w-3" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}