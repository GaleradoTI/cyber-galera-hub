import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Briefcase, FileText, GraduationCap, Languages, Mail, MapPin, MessageSquare, Phone, BookOpen, Tag } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

  return (
    <Dialog open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{c?.display_name ?? "Candidato"}</DialogTitle>
          <DialogDescription>{c?.headline || c?.work_area || "Currículo do candidato"}</DialogDescription>
        </DialogHeader>

        {isLoading && <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-32 w-full" /></div>}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {!isLoading && !error && !c && <p className="text-sm text-muted-foreground">Perfil não encontrado.</p>}

        {c && (
          <div className="space-y-5 text-sm">
            <div className="glass rounded-lg border border-primary/20 p-3 space-y-1.5">
              {c.contact_visible ? (
                <>
                  <p className="flex items-center gap-2 break-all"><Mail className="h-4 w-4 shrink-0 text-primary" /> {c.email ? <a className="hover:underline" href={`mailto:${c.email}`}>{c.email}</a> : "—"}</p>
                  <p className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-primary" /> {c.phone || "—"}
                    {whatsapp.length >= 10 && <a className="text-xs text-primary underline" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${whatsapp.length <= 11 ? `55${whatsapp}` : whatsapp}`}>WhatsApp</a>}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Esta pessoa não liberou o contato no banco de talentos. Use a mensagem interna.</p>
              )}
              {place && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-primary" /> {place}</p>}
              {(c.availability || c.preferred_modality || c.salary_expectation) && (
                <p className="text-xs text-muted-foreground">
                  {[c.availability && `Disponibilidade: ${c.availability}`, c.preferred_modality && `Modalidade: ${c.preferred_modality}`, c.salary_expectation && `Pretensão: ${c.salary_expectation}`].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {c.resume_path && (
                <Button size="sm" onClick={() => openResume(c.resume_path!).catch((e) => toast.error(e.message))}>
                  <FileText className="h-4 w-4 mr-1" /> Abrir currículo
                </Button>
              )}
              <Button asChild size="sm" variant="secondary">
                <Link to="/dashboard/mensagens" search={{ to: c.user_id }}><MessageSquare className="h-4 w-4 mr-1" /> Mensagem</Link>
              </Button>
              {links.map(([k, v]) => <Button key={k} asChild size="sm" variant="outline"><a href={v!} target="_blank" rel="noopener noreferrer">{k}</a></Button>)}
            </div>

            {c.bio && <Section title="Sobre"><p className="text-muted-foreground whitespace-pre-line">{c.bio}</p></Section>}
            {(c.tech_tags ?? []).length > 0 && (
              <Section title="Conhecimentos" icon={<Tag className="h-4 w-4" />}>
                <div className="flex flex-wrap gap-1.5">{c.tech_tags!.map((t) => <span key={t} className="text-xs px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">{t}</span>)}</div>
              </Section>
            )}
            <List title="Formação" icon={<GraduationCap className="h-4 w-4" />} items={c.education.map((e) => ({ main: e.course, sub: [e.institution, e.level, e.period] }))} />
            <List title="Experiência" icon={<Briefcase className="h-4 w-4" />} items={c.experiences.map((e) => ({ main: e.role, sub: [e.company, e.period], text: e.description }))} />
            <List title="Cursos e certificações" icon={<BookOpen className="h-4 w-4" />} items={c.courses.map((e) => ({ main: e.name, sub: [e.provider, e.year], href: safeLink(e.url) }))} />
            <List title="Idiomas" icon={<Languages className="h-4 w-4" />} items={c.languages.map((e) => ({ main: e.name, sub: [e.level] }))} />
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <h3 className="font-bold mb-2 flex items-center gap-2">{icon}{title}</h3>
      {children}
    </div>
  );
}

function List({ title, icon, items }: { title: string; icon: ReactNode; items: { main: string; sub: string[]; text?: string; href?: string | null }[] }) {
  return (
    <Section title={title} icon={icon}>
      {items.length === 0 ? <p className="text-xs text-muted-foreground">Não informado.</p> : (
        <ul className="space-y-2">
          {items.map((i, n) => (
            <li key={n} className="border-l-2 border-primary/30 pl-3">
              <p className="font-medium">{i.main}</p>
              <p className="text-xs text-muted-foreground">{i.sub.filter(Boolean).join(" · ")}</p>
              {i.text && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{i.text}</p>}
              {i.href && <a className="text-xs text-primary underline" href={i.href} target="_blank" rel="noopener noreferrer">Ver certificado</a>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
