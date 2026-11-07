import { useState } from "react";
import { Eye, Globe, LayoutGrid, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventCard } from "@/components/public/event-card";
import { JobCard } from "@/components/public/job-card";
import { EventDetailDialog } from "@/components/public/event-detail-dialog";
import { JobDetailDialog } from "@/components/public/job-detail-dialog";
import { ScheduleTimeline } from "@/components/events/schedule";

/** Mostra como evento/vaga ficará no card, na página pública e na lista do painel — antes de salvar. */
export function PublishPreview({ kind, item }: { kind: "evento" | "vaga"; item: Record<string, any> }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(false);
  const data = {
    id: item.id ?? "preview",
    status: item.status ?? "rascunho",
    source: item.source ?? "comunidade",
    speakers: item.speakers ?? [],
    schedule: (item.schedule ?? []).filter((s: any) => s?.title?.trim()),
    technologies: item.technologies ?? [],
    ...item,
    name: item.name || "Nome do evento",
    title: item.title || "Título da vaga",
    company: item.company || "Empresa",
    description: item.description || "",
  };
  const date = data.event_date ? new Date(`${data.event_date}T00:00:00`).toLocaleDateString("pt-BR") : "sem data";
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Eye className="h-4 w-4 mr-1" /> Pré-visualizar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pré-visualização {kind === "evento" ? "do evento" : "da vaga"}</DialogTitle>
            <DialogDescription>Nada foi salvo ainda. Veja como vai aparecer para as pessoas.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="card">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="card"><LayoutGrid className="h-3.5 w-3.5 mr-1" /> Card</TabsTrigger>
              <TabsTrigger value="site"><Globe className="h-3.5 w-3.5 mr-1" /> Site público</TabsTrigger>
              <TabsTrigger value="dash"><LayoutDashboard className="h-3.5 w-3.5 mr-1" /> Painel</TabsTrigger>
            </TabsList>
            <TabsContent value="card" className="pt-4">
              <div className="max-w-sm mx-auto pointer-events-none">
                {kind === "evento" ? <EventCard event={data} /> : <JobCard job={data} onClick={() => {}} />}
              </div>
            </TabsContent>
            <TabsContent value="site" className="pt-4 space-y-4">
              <div className="glass rounded-xl border border-border/40 p-5 space-y-3">
                {kind === "evento" && data.cover_url && <img src={data.cover_url} alt="" className="w-full aspect-video object-cover rounded-lg" />}
                <h2 className="text-2xl font-black">{kind === "evento" ? data.name : data.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {kind === "evento"
                    ? `${date}${data.event_time ? ` · ${String(data.event_time).slice(0, 5)}` : ""}${data.end_time ? ` – ${String(data.end_time).slice(0, 5)}` : ""} · ${data.modality ?? ""}${data.address ? ` · ${data.address}` : ""}`
                    : `${data.company} · ${data.modality ?? ""} · ${data.seniority ?? ""}${data.location ? ` · ${data.location}` : ""}`}
                </p>
                {data.description && <p className="text-sm whitespace-pre-line line-clamp-[12]">{data.description}</p>}
                {kind === "evento" && data.schedule.length > 0 && (
                  <div><h3 className="font-bold mb-3">Programação</h3><ScheduleTimeline items={data.schedule} /></div>
                )}
              </div>
              <Button type="button" variant="secondary" onClick={() => setDetail(true)}>Abrir janela de detalhes do site</Button>
            </TabsContent>
            <TabsContent value="dash" className="pt-4">
              <div className="glass rounded-xl border border-primary/20 p-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium flex-1 min-w-0 truncate">{kind === "evento" ? data.name : data.title}</span>
                {kind === "evento" ? (
                  <>
                    <span className="text-muted-foreground">{date} {data.event_time ? String(data.event_time).slice(0, 5) : ""}</span>
                    <Badge variant="outline">{data.modality}</Badge>
                  </>
                ) : (
                  <>
                    <span className="text-muted-foreground">{data.company}</span>
                    <Badge variant="outline">{data.seniority}</Badge>
                  </>
                )}
                <Badge variant={data.status === "publicado" ? "default" : "secondary"}>{data.status}</Badge>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      {kind === "evento"
        ? <EventDetailDialog event={detail ? data : null} open={detail} onOpenChange={setDetail} />
        : <JobDetailDialog job={detail ? data : null} open={detail} onOpenChange={setDetail} />}
    </>
  );
}
