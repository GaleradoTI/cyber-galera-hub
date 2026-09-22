import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const TARGET_URL =
  "https://script.google.com/macros/s/AKfycbxuT4UPVPBvOkp7EL-PzAFok0_Da9Db7sl8HYZbauDDv1NTpKE14Y9FPKASdrk0CfM/exec";

export const Route = createFileRoute("/validarcertificado")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const incomingUrl = new URL(request.url);
        const target = new URL(TARGET_URL);
        target.search = incomingUrl.search;
        return Response.redirect(target.toString(), 302);
      },
    },
  },
});
