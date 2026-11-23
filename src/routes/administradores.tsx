import { createFileRoute, redirect } from "@tanstack/react-router";

// Unificado em /comunidade (abas). Mantém links antigos funcionando.
export const Route = createFileRoute("/administradores")({
  beforeLoad: () => {
    throw redirect({ to: "/comunidade", search: { aba: "administradores" }, replace: true });
  },
});
