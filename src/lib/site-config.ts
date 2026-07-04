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

export type NavChild = { to: string; label: string; description?: string };
export type NavItem = { label: string; to?: string; children?: NavChild[] };

export const NAV_LINKS: NavItem[] = [
  { to: "/", label: "Início" },
  { to: "/sobre", label: "Sobre" },
  {
    label: "Comunidade",
    children: [
      { to: "/embaixadores", label: "Embaixadores", description: "Quem representa a galera" },
      { to: "/administradores", label: "Administradores", description: "Time que mantém tudo de pé" },
      { to: "/parceiros", label: "Parceiros", description: "Marcas que caminham com a gente" },
    ],
  },
  {
    label: "Oportunidades",
    children: [
      { to: "/vagas", label: "Vagas", description: "Posições abertas na comunidade" },
      { to: "/projetos", label: "Projetos", description: "Projetos abertos para colaborar" },
    ],
  },
  {
    label: "Conteúdo",
    children: [
      { to: "/eventos", label: "Eventos", description: "Meetups, lives e workshops" },
      { to: "/drops", label: "Drops", description: "Lançamentos e novidades" },
      { to: "/canais", label: "Canais", description: "Onde a comunidade conversa" },
    ],
  },
  { to: "/faq", label: "FAQ" },
];