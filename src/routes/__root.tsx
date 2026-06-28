import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lovable App" },
      { name: "description", content: "Cybernetic Hub is a SaaS platform for the \"GALERA DO T.I.\" community, fostering tech networking, job opportunities, and event discovery." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "Cybernetic Hub is a SaaS platform for the \"GALERA DO T.I.\" community, fostering tech networking, job opportunities, and event discovery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Lovable App" },
      { name: "twitter:description", content: "Cybernetic Hub is a SaaS platform for the \"GALERA DO T.I.\" community, fostering tech networking, job opportunities, and event discovery." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9d6badbf-de8b-4f18-afd6-fc5d71d9dcff/id-preview-0bb99fbb--57625f63-7ae3-4706-b0ad-4be234af2662.lovable.app-1779723059559.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9d6badbf-de8b-4f18-afd6-fc5d71d9dcff/id-preview-0bb99fbb--57625f63-7ae3-4706-b0ad-4be234af2662.lovable.app-1779723059559.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInvalidator />
      <DynamicSiteHead />
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}

function DynamicSiteHead() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("public_site_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["seo", "favicon", "site_fonts"]);
      if (cancelled || error || !data) return;
      const seo = (data.find((r) => r.setting_key === "seo")?.setting_value ?? {}) as Record<string, string>;
      const favicon = (data.find((r) => r.setting_key === "favicon")?.setting_value ?? {}) as Record<string, string>;
      const fonts = (data.find((r) => r.setting_key === "site_fonts")?.setting_value ?? {}) as Record<string, string>;

      if (seo.default_title) document.title = seo.default_title;

      const setMeta = (selector: string, attr: "name" | "property", key: string, content?: string) => {
        if (!content) return;
        let el = document.head.querySelector<HTMLMetaElement>(selector);
        if (!el) {
          el = document.createElement("meta");
          el.setAttribute(attr, key);
          document.head.appendChild(el);
        }
        el.setAttribute("content", content);
      };
      setMeta('meta[name="description"]', "name", "description", seo.default_description);
      setMeta('meta[name="keywords"]', "name", "keywords", seo.keywords);
      setMeta('meta[name="author"]', "name", "author", seo.author);
      setMeta('meta[property="og:title"]', "property", "og:title", seo.default_title);
      setMeta('meta[property="og:description"]', "property", "og:description", seo.default_description);
      setMeta('meta[property="og:image"]', "property", "og:image", seo.og_image);
      setMeta('meta[name="twitter:title"]', "name", "twitter:title", seo.default_title);
      setMeta('meta[name="twitter:description"]', "name", "twitter:description", seo.default_description);
      setMeta('meta[name="twitter:image"]', "name", "twitter:image", seo.og_image);
      setMeta('meta[name="twitter:site"]', "name", "twitter:site", seo.twitter_site);
      // Specific twitter overrides
      setMeta('meta[name="twitter:card"]', "name", "twitter:card", seo.twitter_card);
      setMeta('meta[name="twitter:creator"]', "name", "twitter:creator", seo.twitter_creator);
      if (seo.twitter_title) setMeta('meta[name="twitter:title"]', "name", "twitter:title", seo.twitter_title);
      if (seo.twitter_description) setMeta('meta[name="twitter:description"]', "name", "twitter:description", seo.twitter_description);
      if (seo.twitter_image) setMeta('meta[name="twitter:image"]', "name", "twitter:image", seo.twitter_image);

      const setLink = (rel: string, href?: string) => {
        if (!href) return;
        let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
        if (!el) {
          el = document.createElement("link");
          el.setAttribute("rel", rel);
          document.head.appendChild(el);
        }
        el.setAttribute("href", href);
      };
      if (fonts.google_fonts_url) {
        let preconnectGoogle = document.head.querySelector<HTMLLinkElement>('link[data-site-font="google-preconnect"]');
        if (!preconnectGoogle) {
          preconnectGoogle = document.createElement("link");
          preconnectGoogle.rel = "preconnect";
          preconnectGoogle.href = "https://fonts.googleapis.com";
          preconnectGoogle.dataset.siteFont = "google-preconnect";
          document.head.appendChild(preconnectGoogle);
        }
        let preconnectGstatic = document.head.querySelector<HTMLLinkElement>('link[data-site-font="gstatic-preconnect"]');
        if (!preconnectGstatic) {
          preconnectGstatic = document.createElement("link");
          preconnectGstatic.rel = "preconnect";
          preconnectGstatic.href = "https://fonts.gstatic.com";
          preconnectGstatic.crossOrigin = "anonymous";
          preconnectGstatic.dataset.siteFont = "gstatic-preconnect";
          document.head.appendChild(preconnectGstatic);
        }
        let stylesheet = document.head.querySelector<HTMLLinkElement>('link[data-site-font="stylesheet"]');
        if (!stylesheet) {
          stylesheet = document.createElement("link");
          stylesheet.rel = "stylesheet";
          stylesheet.dataset.siteFont = "stylesheet";
          document.head.appendChild(stylesheet);
        }
        stylesheet.href = fonts.google_fonts_url;
      }
      if (fonts.body_font) document.documentElement.style.setProperty("--site-font-body", `"${fonts.body_font}", system-ui, sans-serif`);
      if (fonts.heading_font) document.documentElement.style.setProperty("--site-font-heading", `"${fonts.heading_font}", var(--site-font-body)`);
      setLink("icon", favicon.url);
      setLink("apple-touch-icon", favicon.apple_touch_url);
      setLink("canonical", seo.site_url);
      if (seo.site_url) {
        setMeta('meta[property="og:url"]', "property", "og:url", seo.site_url);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return null;
}

function AuthInvalidator() {
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      qc.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, qc]);
  return null;
}
