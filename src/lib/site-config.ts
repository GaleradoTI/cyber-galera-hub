export const SITE_CONFIG = {
  name: "GALERA DO T.I.",
  shortName: "GTI",
  slogan: "Se tem código, tem solução. Se não tem, a gente cria.",
  description:
    "A maior comunidade tech para networking, aprendizado, compartilhamento e oportunidades da área de tecnologia.",
  url: "https://galeradoti.com.br",
  email: "contato@galeradoti.com.br",
  legal: {
    termsVersion: "1.0",
    privacyVersion: "1.0",
  },
} as const;

export const NAV_LINKS = [
  { to: "/", label: "Início" },
  { to: "/sobre", label: "Sobre" },
  { to: "/canais", label: "Canais" },
  { to: "/vagas", label: "Vagas" },
  { to: "/eventos", label: "Eventos" },
  { to: "/faq", label: "FAQ" },
] as const;