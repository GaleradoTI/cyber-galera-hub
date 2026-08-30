import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Settings, Grid3X3, ImageIcon, Users, UserPlus, ExternalLink, BadgeCheck, Lock, MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RichText } from "@/lib/rich-text";
import { useFollowStats } from "@/hooks/use-follow";
import { cn } from "@/lib/utils";

type Post = {
  id: string;
  content: string;
  title: string | null;
  cover_url: string | null;
  images: string[] | null;
  created_at: string;
  kind: string;
};

type MiniProfile = { user_id: string; display_name: string | null; avatar_url: string | null; work_area: string | null };

const TABS = [
  { key: "posts", label: "Publicações", icon: Grid3X3 },
  { key: "media", label: "Mídias", icon: ImageIcon },
  { key: "followers", label: "Seguidores", icon: Users },
  { key: "following", label: "Seguindo", icon: UserPlus },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function ProfileSocial({
  userId,
  profile,
  onOpenSettings,
}: {
  userId: string;
  profile: any;
  onOpenSettings: () => void;
}) {
  const [tab, setTab] = useState<TabKey>("posts");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const { followers, following } = useFollowStats(userId);

  const { data: posts = [] } = useQuery({
    queryKey: ["my-feed-posts", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("member_feed_posts")
        .select("id,content,title,cover_url,images,created_at,kind")
        .eq("author_id", userId)
        .neq("status", "deleted")
        .order("created_at", { ascending: false })
        .limit(60);
      return ((data ?? []) as unknown) as Post[];
    },
  });

  const media = useMemo(
    () =>
      posts.flatMap((p) => [...(p.images ?? []), ...(p.cover_url ? [p.cover_url] : [])]).filter(Boolean),
    [posts],
  );

  const name = profile?.display_name || "Membro";
  const socials = Object.entries((profile?.social_links ?? {}) as Record<string, string>).filter(([, v]) => v);

  return (
    <div className="space-y-5">
      <section className="glass rounded-xl border border-primary/20 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
          <Avatar className="h-20 w-20 sm:h-28 sm:w-28 shrink-0 mx-auto sm:mx-0 border-2 border-primary/40">
            <AvatarImage src={profile?.avatar_url ?? undefined} alt={name} />
            <AvatarFallback className="text-2xl font-black">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-black truncate">{name}</h2>
                {profile?.work_area && (
                  <p className="text-xs text-primary truncate">{profile.work_area}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={onOpenSettings} aria-label="Configurações do perfil">
                <Settings className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center sm:max-w-sm">
              <Stat label="publicações" value={posts.length} />
              <Stat label="seguidores" value={followers} />
              <Stat label="seguindo" value={following} />
            </div>

            <div className="rounded-lg border border-border/50 bg-muted/10 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-muted-foreground">
                <BadgeCheck className="h-3.5 w-3.5 text-primary" /> BIO PÚBLICA
              </div>
              <p className="text-sm text-foreground/85 whitespace-pre-wrap break-words">
                {profile?.bio || "Você ainda não escreveu sua bio. Conte sua trajetória, stack e o que procura."}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Info label="Cargo / área" value={profile?.work_area || "—"} />
                <Info label="Stack principal" value={(profile?.tech_tags ?? [])[0] || "—"} />
                <Info
                  label="Disponibilidade"
                  value={profile?.looking_for_job ? "Aberto a oportunidades" : "Não buscando agora"}
                />
              </div>

              {(profile?.tech_tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(profile.tech_tags as string[]).map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              )}

              <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                <Lock className="h-3 w-3 mt-0.5 shrink-0" />
                Telefone, endereço completo e data de nascimento são dados pessoais (LGPD) e nunca aparecem aqui —
                recrutadores só veem bio, cargo, nível, stack e disponibilidade. Região/UF só é compartilhada com seu
                consentimento nas configurações.
              </p>
            </div>

            {socials.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {socials.map(([k, v]) => (
                  <a
                    key={k}
                    href={v.startsWith("http") ? v : `https://${v}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs rounded-full border border-primary/30 px-3 py-1 text-primary hover:bg-primary/10"
                  >
                    <ExternalLink className="h-3 w-3" /> {k}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="glass rounded-xl border border-border/40 overflow-x-auto">
        <div className="flex min-w-max">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "flex-1 min-w-[110px] flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition",
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "posts" && (
        <div className="space-y-3">
          {posts.length === 0 && <Empty text="Você ainda não publicou nada no feed." />}
          {posts.map((p) => (
            <article key={p.id} className="glass rounded-xl border border-border/40 p-4">
              <div className="text-[10px] text-muted-foreground">
                {new Date(p.created_at).toLocaleString("pt-BR")}
              </div>
              {p.title && <h3 className="font-bold mt-1">{p.title}</h3>}
              {p.content && <RichText text={p.content} className="text-sm mt-2" />}
              {(p.images ?? []).length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {(p.images ?? []).map((src) => (
                    <button key={src} type="button" onClick={() => setLightbox(src)}>
                      <img src={src} alt="" loading="lazy" className="rounded-lg w-full h-40 object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
          <div className="text-center">
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard/feed">Ir para o feed</Link>
            </Button>
          </div>
        </div>
      )}

      {tab === "media" && (
        <>
          {media.length === 0 ? (
            <Empty text="Nenhuma mídia enviada ainda. Publique uma foto no feed." />
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2">
              {media.map((src, i) => (
                <button key={`${src}-${i}`} type="button" onClick={() => setLightbox(src)} className="aspect-square">
                  <img src={src} alt="" loading="lazy" className="w-full h-full object-cover rounded-md" />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "followers" && <PeopleList userId={userId} mode="followers" />}
      {tab === "following" && <PeopleList userId={userId} mode="following" />}

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-3xl p-2">
          {lightbox && <img src={lightbox} alt="" className="w-full max-h-[80vh] object-contain rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-lg border border-border/40 py-2">
      <div className="text-lg font-black tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">{text}</div>;
}

function PeopleList({ userId, mode }: { userId: string; mode: "followers" | "following" }) {
  const { data: people = [] } = useQuery({
    queryKey: ["profile-people", userId, mode],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("user_follows")
        .select("follower_id,following_id")
        .eq(mode === "followers" ? "following_id" : "follower_id", userId);
      const ids = (rows ?? []).map((r: any) => (mode === "followers" ? r.follower_id : r.following_id));
      if (ids.length === 0) return [] as MiniProfile[];
      const { data } = await supabase
        .from("profiles")
        .select("user_id,display_name,avatar_url,work_area")
        .in("user_id", ids);
      return ((data ?? []) as unknown) as MiniProfile[];
    },
  });

  if (people.length === 0) {
    return <Empty text={mode === "followers" ? "Ninguém te segue ainda." : "Você ainda não segue ninguém."} />;
  }

  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {people.map((p) => {
        const n = p.display_name || "Membro";
        return (
          <div key={p.user_id} className="glass rounded-xl border border-border/40 p-3 flex items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={p.avatar_url ?? undefined} alt={n} />
              <AvatarFallback>{n.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{n}</div>
              {p.work_area && <div className="text-xs text-muted-foreground truncate">{p.work_area}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
