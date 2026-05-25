import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — GALERA DO T.I." }, { name: "robots", content: "noindex" }] }),
  component: () => <Outlet />,
});