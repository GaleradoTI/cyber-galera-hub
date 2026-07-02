import { useState } from "react";
import { ExternalLink, Info } from "lucide-react";
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
  const primaryLink = links[0];

  return (
    <>
      <article className="glass rounded-xl border border-primary/20 p-5 hover-glow-cyan flex flex-col h-full">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4">
          <Avatar className="h-16 w-16 shrink-0 border border-secondary/30">
            <AvatarImage src={profile.photo_url ?? undefined} alt={profile.name} className="object-cover" />
            <AvatarFallback>{profile.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="font-black text-lg leading-tight truncate">{profile.name}</h2>
            {profile.role_title && <p className="text-sm text-secondary mt-1 line-clamp-2">{profile.role_title}</p>}
            {profile.community_role && (
              <Badge variant="outline" className="mt-2 text-[10px]">{profile.community_role}</Badge>
            )}
          </div>
        </div>

        <div className="mt-auto pt-5 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)} className="flex-1 min-w-[7rem]">
            <Info className="h-3.5 w-3.5 mr-1.5" /> Saiba mais
          </Button>
          {primaryLink && (
            <a
              href={primaryLink.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline px-2"
            >
              {primaryLink.label || "Link"} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </article>

      <Dialog open={open} onOpenChange={setOpen}>
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
                    {links.map((link) => (
                      <a
                        key={`${link.label}-${link.url}`}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border/40 hover:border-primary/50 hover:text-primary transition"
                      >
                        {link.label || "Link"} <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
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