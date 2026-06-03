import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const FALLBACK_URL = "https://galera-do-ti.lovable.app";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        let baseUrl = FALLBACK_URL;
        const dynamicEntries: SitemapEntry[] = [];

        if (SUPABASE_URL && SUPABASE_KEY) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
          const { data: settings } = await supabase
            .from("public_site_settings")
            .select("setting_key, setting_value")
            .in("setting_key", ["seo"]);
          const seo = (settings?.find((s: any) => s.setting_key === "seo")?.setting_value ?? {}) as Record<string, string>;
          if (seo.site_url) baseUrl = seo.site_url.replace(/\/$/, "");

          const { data: projects } = await supabase
            .from("projects")
            .select("slug, updated_at")
            .eq("is_public", true);
          for (const p of projects ?? []) {
            dynamicEntries.push({
              path: `/projetos/${p.slug}`,
              lastmod: p.updated_at ? new Date(p.updated_at).toISOString() : undefined,
              changefreq: "weekly",
              priority: "0.7",
            });
          }
        }

        const staticEntries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/sobre", changefreq: "monthly", priority: "0.8" },
          { path: "/vagas", changefreq: "daily", priority: "0.9" },
          { path: "/eventos", changefreq: "daily", priority: "0.9" },
          { path: "/projetos", changefreq: "weekly", priority: "0.8" },
          { path: "/canais", changefreq: "weekly", priority: "0.7" },
          { path: "/faq", changefreq: "monthly", priority: "0.6" },
          { path: "/privacidade", changefreq: "yearly", priority: "0.3" },
          { path: "/termos", changefreq: "yearly", priority: "0.3" },
          { path: "/login", changefreq: "yearly", priority: "0.4" },
          { path: "/cadastro", changefreq: "yearly", priority: "0.5" },
        ];

        const all = [...staticEntries, ...dynamicEntries];
        const urls = all.map((e) =>
          [
            `  <url>`,
            `    <loc>${baseUrl}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=600",
          },
        });
      },
    },
  },
});