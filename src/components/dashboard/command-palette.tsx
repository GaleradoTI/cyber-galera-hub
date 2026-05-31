import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Calendar, FolderKanban, Users, Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardRoles } from "./dashboard-shell";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { isAdmin } = useDashboardRoles();

  const { data: jobs = [] } = useQuery({
    queryKey: ["palette-jobs"],
    enabled: open,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("id,title,company").eq("status", "publicado").limit(20);
      return data ?? [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["palette-projects"],
    enabled: open,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id,name,slug").limit(20);
      return data ?? [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["palette-events"],
    enabled: open,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id,name,event_date").eq("status", "publicado").limit(20);
      return data ?? [];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["palette-users"],
    enabled: open && isAdmin,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id,display_name").limit(20);
      return data ?? [];
    },
  });

  const go = (path: string) => { onOpenChange(false); navigate({ to: path }); };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar vagas, projetos, eventos…" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>

        <CommandGroup heading="Navegação">
          <CommandItem onSelect={() => go("/dashboard")}><Search className="h-3 w-3 mr-2" />Visão geral</CommandItem>
          <CommandItem onSelect={() => go("/dashboard/perfil")}><Users className="h-3 w-3 mr-2" />Meu perfil</CommandItem>
          <CommandItem onSelect={() => go("/dashboard/mensagens")}><Users className="h-3 w-3 mr-2" />Mensagens</CommandItem>
        </CommandGroup>

        {jobs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Vagas publicadas">
              {jobs.map((j: any) => (
                <CommandItem key={j.id} onSelect={() => go("/vagas")}>
                  <Briefcase className="h-3 w-3 mr-2" />
                  <span className="truncate">{j.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground truncate">{j.company}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projetos">
              {projects.map((p: any) => (
                <CommandItem key={p.id} onSelect={() => go(`/projetos/${p.slug}`)}>
                  <FolderKanban className="h-3 w-3 mr-2" />
                  <span className="truncate">{p.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {events.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Eventos">
              {events.map((e: any) => (
                <CommandItem key={e.id} onSelect={() => go("/eventos")}>
                  <Calendar className="h-3 w-3 mr-2" />
                  <span className="truncate">{e.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{e.event_date}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {isAdmin && users.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Usuários">
              {users.map((u: any) => (
                <CommandItem key={u.user_id} onSelect={() => go("/dashboard/usuarios")}>
                  <Users className="h-3 w-3 mr-2" />
                  <span className="truncate">{u.display_name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);
  return { open, setOpen };
}