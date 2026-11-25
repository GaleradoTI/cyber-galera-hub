import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, Briefcase, CalendarClock, Copy, ExternalLink, FileText, GraduationCap, Languages, Laptop, Lock, Mail, MapPin, MessageSquare, Phone, Tag, Wallet, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonAvatar, TagList } from "@/components/jobs/shared";
import { db, openResume, safeLink, type CandidateDetails } from "@/lib/resume";

export function CandidateDialog({ userId, onClose, footer }: { userId: string | null; onClose: () => void; footer?: ReactNode }) {
  const { data: c, isLoading, error } = useQuery({
    queryKey: ["candidate-details", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db.rpc("get_candidate_details", { _user_id: userId });
      if (error) throw error;
      return data as CandidateDetails | null;
    },
  });
  const place = [c?.city, c?.state].filter(Boolean).join("/");
  const links = Object.entries(c?.social_links ?? {}).map(([k, v]) => [k, safeLink(v)] as const).filter(([, v]) => v);
  const whatsapp = (c?.phone ?? "").replace(/\D/g, "");

  const copy = (value: string, label: string) => navigator.clipboard.writeText(value)
    .then(() => toast.success(`${label} copiado`), () => toast.error("Não foi possível copiar"));

  const contactRow = (Icon: LucideIcon, label: string, value: string | null, href?: string) => value && (
    <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline">{value}</a> : <span className="min-w-0 flex-1 truncate">{value}</span>}
      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label={`Copiar ${label}`} onClick={() => copy(value, label)}><Copy className="h-3.5 w-3.5" /></Button>
    </div>
  );

  const facts: [LucideIcon, string, string | null | undefined][] = [
    [MapPin, "Local", place],
    [CalendarClock, "Disponibilidade", c?.availability],
    [Laptop, "Modalidade", c?.preferred_modality],
    [Wallet, "Pretensão", c?.salary_expectation],
  ];

  return (
    <Dialog open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 text-left">
            {c && <PersonAvatar name={c.display_name} url={c.avatar_url} className="h-16 w-16" />}
            <div className="min-w-0">
              <DialogTitle className="text-xl">{c?.display_name ?? "Candidato"}</DialogTitle>
              <DialogDescription>{c ? [c.headline || c.work_area, c.looking_for_job && "Em busca de oportunidade"].filter(Boolean).join(" · ") || "Currículo do candidato" : "Currículo do candidato"}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading && <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-40 w-full" /></div>}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {!isLoading && !error && !c && <p className="text-sm text-muted-foreground">Perfil não encontrado.</p>}

        {c && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              {c.resume_path && <Button size="sm" variant="neon" onClick={() => openResume(c.resume_path!).catch((e) => toast.error(e.message))}><FileText className="h-4 w-4 mr-1" /> Abrir currículo</Button>}
              {c.contact_visible && whatsapp.length >= 10 && <Button asChild size="sm" variant="outline"><a target="_blank" rel="noopener noreferrer" href={`https://wa.me/${whatsapp.length <= 11 ? `55${whatsapp}` : whatsapp}`}><Phone className="h-4 w-4 mr-1" /> WhatsApp</a></Button>}
              {c.contact_visible && c.email && <Button asChild size="sm" variant="outline"><a href={`mailto:${c.email}`}><Mail className="h-4 w-4 mr-1" /> E-mail</a></Button>}
              <Button asChild size="sm" variant="secondary"><Link to="/dashboard/mensagens" search={{ to: c.user_id }}><MessageSquare className="h-4 w-4 mr-1" /> Mensagem</Link></Button>
            </div>

            {footer}

            {c.contact_visible ? (
              <div className="grid sm:grid-cols-2 gap-2">
                {contactRow(Mail, "e-mail", c.email)}
                {contactRow(Phone, "telefone", c.phone)}
              </div>
            ) : (
              <p className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-muted-foreground"><Lock className="h-4 w-4 shrink-0" /> Esta pessoa não liberou o contato no banco de talentos. Use a mensagem interna.</p>
            )}

            {facts.some(([, , v]) => v) && (
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {facts.filter(([, , v]) => v).map(([Icon, label, value]) => (
                  <div key={label} className="glass rounded-lg border border-primary/15 p-2">
                    <dt className="flex items-center gap-1 text-[11px] text-muted-foreground"><Icon className="h-3 w-3" /> {label}</dt>
                    <dd className="mt-0.5 font-medium break-words">{value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {(c.tech_tags ?? []).length > 0 && (
              <div>
                <h3 className="font-bold mb-2 flex items-center gap-2"><Tag className="h-4 w-4 text-primary" /> Conhecimentos</h3>
                <TagList tags={c.tech_tags} max={30} />
              </div>
            )}

            <Tabs defaultValue="perfil">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="perfil"><Briefcase className="h-3.5 w-3.5 mr-1" /> Experiência</TabsTrigger>
                <TabsTrigger value="formacao"><GraduationCap className="h-3.5 w-3.5 mr-1" /> Formação</TabsTrigger>
                <TabsTrigger value="cursos"><BookOpen className="h-3.5 w-3.5 mr-1" /> Cursos</TabsTrigger>
              </TabsList>
              <TabsContent value="perfil" className="space-y-4 pt-2">
                {c.bio && <p className="text-muted-foreground whitespace-pre-line">{c.bio}</p>}
                <Timeline empty="Nenhuma experiência informada." items={c.experiences.map((e) => ({ main: e.role, sub: [e.company, e.period], text: e.description }))} />
                {links.length > 0 && <div className="flex flex-wrap gap-2">{links.map(([k, v]) => <Button key={k} asChild size="sm" variant="outline"><a href={v!} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1" /> {k}</a></Button>)}</div>}
              </TabsContent>
              <TabsContent value="formacao" className="space-y-4 pt-2">
                <Timeline empty="Nenhuma formação informada." items={c.education.map((e) => ({ main: e.course, sub: [e.institution, e.level, e.period] }))} />
                {c.languages.length > 0 && (
                  <div>
                    <h3 className="font-bold mb-2 flex items-center gap-2"><Languages className="h-4 w-4 text-primary" /> Idiomas</h3>
                    <Timeline empty="" items={c.languages.map((e) => ({ main: e.name, sub: [e.level] }))} />
                  </div>
                )}
              </TabsContent>
              <TabsContent value="cursos" className="pt-2">
                <Timeline empty="Nenhum curso informado." items={c.courses.map((e) => ({ main: e.name, sub: [e.provider, e.year], href: safeLink(e.url) }))} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Timeline({ items, empty }: { items: { main: string; sub: string[]; text?: string; href?: string | null }[]; empty: string }) {
  if (items.length === 0) return <p className="text-xs text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((i, n) => (
        <li key={n} className="relative border-l-2 border-primary/30 pl-4">
          <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-primary" />
          <p className="font-medium">{i.main}</p>
          <p className="text-xs text-muted-foreground">{i.sub.filter(Boolean).join(" · ")}</p>
          {i.text && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{i.text}</p>}
          {i.href && <a className="text-xs text-primary underline" href={i.href} target="_blank" rel="noopener noreferrer">Ver certificado</a>}
        </li>
      ))}
    </ul>
  );
}
