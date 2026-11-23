import { createFileRoute, redirect } from "@tanstack/react-router";

// Unificado em /comunidade (abas). Mantém links antigos funcionando.
export const Route = createFileRoute("/embaixadores")({
  beforeLoad: () => {
    throw redirect({ to: "/comunidade", search: { aba: "embaixadores" }, replace: true });
  },
});
