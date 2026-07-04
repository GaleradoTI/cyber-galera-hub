import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, MessageSquare, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { downloadCSV } from "@/lib/csv";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/candidatos")({ component: CandidatosPage });

type Candidate = {
  user_id: string;
  display_name: string;
  bio: string | null;
  work_area: string | null;
  looking_for_job: boolean;
  tech_tags: string[] | null;
};

function CandidatosPage() {
  const navigate = useNavigate();
  const { isAdmin, isRecruiter, isAmbassador, rolesReady } = useDashboardRoles();
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("all");
  const [tech, setTech] = useState("all");

  useEffect(() => {
    if (rolesReady && !isAdmin && !isRecruiter && !isAmbassador) navigate({ to: "/dashboard" });
  }, [rolesReady, isAdmin, isRecruiter, isAmbassador, navigate]);

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
    <DashboardShell title="Candidatos" description="Membros sinalizando que estão em busca de oportunidades.">
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

      {isLoading && <p className="text-muted-foreground text-sm">Carregando…</p>}

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((c) => (
          <div key={c.user_id} className="glass rounded-xl p-5 border border-primary/20">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-black text-background">
                  {c.display_name?.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-bold truncate">{c.display_name}</div>
                  {c.work_area && <div className="text-xs text-muted-foreground truncate">{c.work_area}</div>}
                </div>
              </div>
              <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">EM BUSCA</Badge>
            </div>
            {c.bio && <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{c.bio}</p>}

            {(c.tech_tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {c.tech_tags!.map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">{t}</span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
              <Button asChild size="sm" variant="secondary">
                <Link to="/dashboard/mensagens" search={{ to: c.user_id }}>
                  <MessageSquare className="h-3 w-3 mr-1" /> Mensagem
                </Link>
              </Button>
            </div>
          </div>
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-2 text-center py-8">Nenhum candidato encontrado.</p>
        )}
      </div>
    </DashboardShell>
  );
}