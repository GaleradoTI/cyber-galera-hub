import type { ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import { PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/brand/ui-kit";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { PublicLayout } from "@/components/public/public-layout";
import { useSiteModules } from "@/lib/modules";

const NAMES = { drops: "Drops", projects: "Projetos" } as const;

/** Mostra a tela só quando o módulo está ligado em Configurações do Site. */
export function withModule(Page: ComponentType, module: keyof typeof NAMES, area: "public" | "dashboard") {
  return function ModuleGate() {
    const { loading, dropsEnabled, projectsEnabled } = useSiteModules();
    const enabled = module === "drops" ? dropsEnabled : projectsEnabled;
    if (!loading && enabled) return <Page />;
    const body = loading ? <LoadingState /> : <Disabled name={NAMES[module]} area={area} />;
    return area === "public"
      ? <PublicLayout><div className="container mx-auto px-4 py-20">{body}</div></PublicLayout>
      : <DashboardShell title={NAMES[module]}>{body}</DashboardShell>;
  };
}

function Disabled({ name, area }: { name: string; area: "public" | "dashboard" }) {
  const { isAdmin } = useDashboardRoles();
  return (
    <EmptyState icon={PowerOff} title={`${name} está desativado no momento`} text={isAdmin ? "Você pode reativar em Configurações do Site, na aba Avançado." : "Volte em breve."}>
      {isAdmin && <Button asChild><Link to="/dashboard/configuracoes">Abrir configurações</Link></Button>}
      <Button asChild variant="outline"><Link to={area === "public" ? "/" : "/dashboard"}>Voltar ao início</Link></Button>
    </EmptyState>
  );
}
