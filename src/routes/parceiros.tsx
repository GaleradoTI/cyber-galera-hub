import { createFileRoute, redirect } from "@tanstack/react-router";

// Unificado em /comunidade (abas). Mantém links antigos funcionando.
export const Route = createFileRoute("/parceiros")({
  beforeLoad: () => {
    throw redirect({ to: "/comunidade", search: { aba: "parceiros" }, replace: true });
  },
});
