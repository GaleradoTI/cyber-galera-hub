import { LoadingState } from "@/components/brand/ui-kit";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Download, Eye, Inbox, MessageSquare, Search, UserSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles, useAmbassadorCan } from "@/components/dashboard/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { downloadCSV } from "@/lib/csv";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CandidateDialog } from "@/components/jobs/candidate-dialog";
import { ApplicantsPanel } from "@/components/jobs/applicants-panel";
import { EmptyState, PersonAvatar, TagList } from "@/components/jobs/shared";

export const Route = createFileRoute("/dashboard/candidatos")({
  validateSearch: (s: Record<string, unknown>): { vaga?: string } => (typeof s.vaga === "string" ? { vaga: s.vaga } : {}),
  component: CandidatosPage,
});

type Candidate = {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
  bio: string | null;
  work_area: string | null;
  looking_for_job: boolean;
  tech_tags: string[] | null;
};

function CandidatosPage() {
  const navigate = useNavigate();
  const { isAdmin, isRecruiter, isAmbassador, rolesReady } = useDashboardRoles();
  const { can, ready: areasReady } = useAmbassadorCan();
  const isAmbassadorArea = isAmbassador && can("candidatos");
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("all");
  const [tech, setTech] = useState("all");
  const [viewing, setViewing] = useState<string | null>(null);
  const seesApplications = isAdmin || isRecruiter;
  const { vaga } = Route.useSearch();
  const setVaga = (id: string) => navigate({ to: "/dashboard/candidatos", search: id === "all" ? {} : { vaga: id }, replace: true });

  useEffect(() => {
    if (rolesReady && areasReady && !isAdmin && !isRecruiter && !isAmbassadorArea) navigate({ to: "/dashboard" });
  }, [rolesReady, isAdmin, isRecruiter, isAmbassadorArea, navigate]);

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_recruiter_candidates");
      if (error) throw error;
      const rows = (data ?? []) as Candidate[];
      return [...rows].sort((a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? ""));
    },
  });

  const areaOptions = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => c.work_area && set.add(c.work_area));
    return Array.from(set).sort();
  }, [candidates]);
  const techOptions = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => (c.tech_tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [candidates]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return candidates.filter((c) => {
      const matchSearch =
        !q ||
        c.display_name?.toLowerCase().includes(q) ||
        c.work_area?.toLowerCase().includes(q) ||
        c.bio?.toLowerCase().includes(q) ||
        (c.tech_tags ?? []).some((t) => t.toLowerCase().includes(q));
      const matchArea = area === "all" || c.work_area === area;
      const matchTech = tech === "all" || (c.tech_tags ?? []).includes(tech);
      return matchSearch && matchArea && matchTech;
    });
  }, [candidates, search, area, tech]);

  const activeFilters = [area !== "all", tech !== "all"].filter(Boolean).length;

  return (
    <DashboardShell title="Candidatos" description="Quem se candidatou às vagas e membros em busca de oportunidades.">
      <Tabs key={seesApplications ? "com-candidaturas" : "so-talentos"} defaultValue={seesApplications ? "candidaturas" : "talentos"}>
        {seesApplications && (
          <TabsList className="mb-4">
            <TabsTrigger value="candidaturas" className="gap-1.5"><Inbox className="h-4 w-4" /> Candidaturas recebidas</TabsTrigger>
            <TabsTrigger value="talentos" className="gap-1.5"><UserSearch className="h-4 w-4" /> Banco de talentos</TabsTrigger>
          </TabsList>
        )}
        {seesApplications && <TabsContent value="candidaturas"><ApplicantsPanel job={vaga ?? "all"} onJobChange={setVaga} /></TabsContent>}
        <TabsContent value="talentos">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, área, bio ou stack" className="pl-9" />
        </div>
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Área" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">Todas áreas</SelectItem>
            {areaOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tech} onValueChange={setTech}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tecnologia" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">Todas tecnologias</SelectItem>
            {techOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setArea("all"); setTech("all"); }}>
            <X className="h-3 w-3 mr-1" /> Limpar
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (filtered.length === 0) return toast.info("Nada a exportar.");
            downloadCSV(
              `candidatos-${new Date().toISOString().slice(0, 10)}.csv`,
              filtered.map((c) => ({
                nome: c.display_name,
                area: c.work_area ?? "",
                tech_tags: (c.tech_tags ?? []).join("; "),
                bio: (c.bio ?? "").replace(/\s+/g, " ").slice(0, 500),
              })),
            );
            toast.success("CSV gerado.");
          }}
        >
          <Download className="h-3 w-3 mr-1.5" /> Exportar CSV
        </Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} candidato(s)</div>
      </div>

      {isLoading && <LoadingState />}

      {!isLoading && filtered.length === 0 && <EmptyState icon={UserSearch} title="Nenhum candidato encontrado" text="Ajuste a busca ou os filtros." />}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <article key={c.user_id} className="glass rounded-xl p-4 border border-primary/20 flex flex-col gap-3 hover:border-primary/50 transition">
            <div className="flex items-center gap-3 min-w-0">
              <PersonAvatar name={c.display_name ?? "?"} url={c.avatar_url} />
              <div className="min-w-0">
                <h3 className="font-bold truncate">{c.display_name}</h3>
                <p className="flex items-center gap-1 text-xs text-muted-foreground truncate"><Briefcase className="h-3 w-3 shrink-0" /> {c.work_area || "Área não informada"}</p>
              </div>
            </div>
            {c.bio && <p className="text-sm text-muted-foreground line-clamp-3">{c.bio}</p>}
            <TagList tags={c.tech_tags} max={6} />
            <div className="mt-auto flex gap-2 border-t border-border/40 pt-3">
              <Button size="sm" className="flex-1" onClick={() => setViewing(c.user_id)}><Eye className="h-3.5 w-3.5 mr-1" /> Ver perfil</Button>
              <Button asChild size="sm" variant="secondary">
                <Link to="/dashboard/mensagens" search={{ to: c.user_id }}><MessageSquare className="h-3.5 w-3.5 mr-1" /> Mensagem</Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
        </TabsContent>
      </Tabs>
      <CandidateDialog userId={viewing} onClose={() => setViewing(null)} />
    </DashboardShell>
  );
}