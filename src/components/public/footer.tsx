import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/logo";
import { SITE_CONFIG } from "@/lib/site-config";
import { Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-background/50 backdrop-blur-xl mt-24">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2 space-y-4">
            <Logo />
            <p className="text-sm text-muted-foreground max-w-sm">
              A comunidade tech que conecta pessoas, gera oportunidades e
              transforma carreiras.
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 text-secondary" />
              {SITE_CONFIG.email}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-3 text-sm tracking-wider uppercase text-foreground">
              Navegação
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/sobre" className="text-muted-foreground hover:text-secondary transition-colors">Sobre</Link></li>
              <li><Link to="/canais" className="text-muted-foreground hover:text-secondary transition-colors">Canais</Link></li>
              <li><Link to="/vagas" className="text-muted-foreground hover:text-secondary transition-colors">Vagas</Link></li>
              <li><Link to="/eventos" className="text-muted-foreground hover:text-secondary transition-colors">Eventos</Link></li>
              <li><Link to="/faq" className="text-muted-foreground hover:text-secondary transition-colors">FAQ</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3 text-sm tracking-wider uppercase text-foreground">
              Conta
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/login" className="text-muted-foreground hover:text-secondary transition-colors">Login</Link></li>
              <li><Link to="/cadastro" className="text-muted-foreground hover:text-secondary transition-colors">Cadastrar</Link></li>
              <li><Link to="/termos" className="text-muted-foreground hover:text-secondary transition-colors">Termos de Uso</Link></li>
              <li><Link to="/privacidade" className="text-muted-foreground hover:text-secondary transition-colors">Privacidade</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} {SITE_CONFIG.name}. Todos os direitos reservados.</p>
          <p>Construído com ⚡ pela comunidade.</p>
        </div>
      </div>
    </footer>
  );
}