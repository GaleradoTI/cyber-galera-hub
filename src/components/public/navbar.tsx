import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X, LogOut, LayoutDashboard, ChevronDown } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { NAV_LINKS } from "@/lib/site-config";
import { useAuth, signOut } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div className="container mx-auto grid h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4">
        <div className="shrink-0"><Logo /></div>

        <nav className="hidden md:flex items-center justify-center gap-0.5 lg:gap-1 min-w-0">
          {NAV_LINKS.map((link) => {
            if (link.children?.length) {
              const active = link.children.some((c) => pathname === c.to);
              return (
                <DropdownMenu key={link.label}>
                  <DropdownMenuTrigger
                    className={cn(
                      "inline-flex items-center gap-1 px-2 lg:px-3 py-2 text-sm font-medium rounded-md transition-colors outline-none whitespace-nowrap",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {link.label}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[240px]">
                    {link.children.map((c) => (
                      <DropdownMenuItem asChild key={c.to} className="cursor-pointer">
                        <Link to={c.to} className="flex flex-col items-start gap-0.5 py-2">
                          <span className="text-sm font-medium">{c.label}</span>
                          {c.description && (
                            <span className="text-[11px] text-muted-foreground">{c.description}</span>
                          )}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }
            const active = pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to!}
                className={cn(
                  "relative px-2 lg:px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
                {active && (
                  <span className="absolute left-1/2 -bottom-0.5 h-0.5 w-6 -translate-x-1/2 bg-gradient-neon rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-1.5 lg:gap-2 justify-end shrink-0">
          {loading ? null : isAuthenticated ? (
            <>
              <Button asChild variant="outline" size="sm" className="px-2 lg:px-3">
                <Link to="/dashboard">
                  <LayoutDashboard className="h-4 w-4 lg:mr-2" />
                  <span className="hidden lg:inline">Dashboard</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline" size="sm" className="px-2 lg:px-3">
                <Link to="/login">Entrar</Link>
              </Button>
              <Button asChild variant="neon" size="sm" className="px-2 lg:px-3">
                <Link to="/cadastro">Cadastrar</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="md:hidden text-foreground justify-self-end"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl max-h-[calc(100vh-4rem)] overflow-y-auto">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              if (link.children?.length) {
                return (
                  <div key={link.label} className="py-1">
                    <div className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-[0.25em] text-muted-foreground/70">
                      {link.label.toUpperCase()}
                    </div>
                    {link.children.map((c) => (
                      <Link
                        key={c.to}
                        to={c.to}
                        onClick={() => setOpen(false)}
                        className="block px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                );
              }
              return (
                <Link
                  key={link.to}
                  to={link.to!}
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50"
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="flex gap-2 pt-3 border-t border-border/40 mt-2">
              {isAuthenticated ? (
                <>
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link to="/dashboard">Dashboard</Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => signOut()}>
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link to="/login">Entrar</Link>
                  </Button>
                  <Button asChild variant="neon" size="sm" className="flex-1">
                    <Link to="/cadastro">Cadastrar</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}