import { Crown, Mail, Phone, Briefcase, Linkedin, Github, Instagram, Twitter, Globe, MessageSquare } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/components/dashboard/follow-button";
import { useFollowStats } from "@/hooks/use-follow";

export type MemberProfile = {
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  email?: string | null;
  phone?: string | null;
  work_area?: string | null;
  tech_tags?: string[] | null;
  social_links?: Record<string, string> | null;
};

const SOCIAL_ICONS: Record<string, any> = {
  linkedin: Linkedin,
  github: Github,
  instagram: Instagram,
  twitter: Twitter,
  website: Globe,
};

export function MemberDetailDialog({
  open,
  onOpenChange,
  profile,
  role,
  squadName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profile: MemberProfile | null;
  role?: string | null;
  squadName?: string | null;
}) {
  if (!profile) return null;
  const initial = (profile.display_name ?? "?").slice(0, 1).toUpperCase();
  const social = (profile.social_links ?? {}) as Record<string, string>;
  const socialEntries = Object.entries(social).filter(([, v]) => v && v.trim().length > 0);
  const stats = useFollowStats(profile.user_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">{profile.display_name}</DialogTitle>
        </DialogHeader>
        <div className="flex items-start gap-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover border border-border/40" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-2xl font-black text-background">
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold leading-tight">{profile.display_name ?? "Sem nome"}</h3>
              {role === "LIDER" && (
                <Badge variant="outline" className="border-secondary text-secondary text-[10px]">
                  <Crown className="h-3 w-3 mr-1" /> Líder
                </Badge>
              )}
            </div>
            {squadName && <p className="text-xs text-muted-foreground mt-0.5">Squad: {squadName}</p>}
            {profile.work_area && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Briefcase className="h-3 w-3" /> {profile.work_area}
              </p>
            )}
            <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
              <span><strong className="text-foreground">{stats.followers}</strong> seguidores</span>
              <span><strong className="text-foreground">{stats.following}</strong> seguindo</span>
              <div className="ml-auto"><FollowButton userId={profile.user_id} /></div>
            </div>
          </div>
        </div>

        {profile.bio && (
          <div className="mt-1">
            <p className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground/70 mb-1">BIO</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.bio}</p>
          </div>
        )}

        {(profile.tech_tags?.length ?? 0) > 0 && (
          <div>
            <p className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground/70 mb-2">TECNOLOGIAS</p>
            <div className="flex flex-wrap gap-1">
              {profile.tech_tags!.map((t) => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">{t}</span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2 text-sm">
          <p className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground/70">CONTATO</p>
          {profile.email ? (
            <a href={`mailto:${profile.email}`} className="flex items-center gap-2 text-sm hover:text-primary">
              <Mail className="h-3.5 w-3.5" /> {profile.email}
            </a>
          ) : (
            <p className="text-xs text-muted-foreground flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> não informado</p>
          )}
          {profile.phone ? (
            <a href={`tel:${profile.phone}`} className="flex items-center gap-2 text-sm hover:text-primary">
              <Phone className="h-3.5 w-3.5" /> {profile.phone}
            </a>
          ) : (
            <p className="text-xs text-muted-foreground flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> não informado</p>
          )}
        </div>

        {socialEntries.length > 0 && (
          <div>
            <p className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground/70 mb-2">REDES</p>
            <div className="flex flex-wrap gap-2">
              {socialEntries.map(([k, v]) => {
                const Icon = SOCIAL_ICONS[k] ?? Globe;
                const href = v.startsWith("http") ? v : `https://${v}`;
                return (
                  <a key={k} href={href} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border/40 hover:border-primary/50 hover:text-primary transition">
                    <Icon className="h-3 w-3" /> {k}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <Button asChild size="sm" variant="secondary">
            <Link to="/dashboard/mensagens" search={{ to: profile.user_id }}>
              <MessageSquare className="h-3 w-3 mr-1.5" /> Enviar mensagem
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}