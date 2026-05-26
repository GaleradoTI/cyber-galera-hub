export const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8, label: "Mínimo 8 caracteres" },
  { test: (p: string) => /[a-z]/.test(p), label: "1 letra minúscula" },
  { test: (p: string) => /[A-Z]/.test(p), label: "1 letra maiúscula" },
  { test: (p: string) => /[0-9]/.test(p), label: "1 número" },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: "1 caractere especial" },
] as const;

export function validatePassword(p: string): { ok: boolean; missing: string[] } {
  const missing = PASSWORD_RULES.filter((r) => !r.test(p)).map((r) => r.label);
  return { ok: missing.length === 0, missing };
}

export function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="text-[11px] space-y-0.5 mt-1">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(value);
        return (
          <li key={r.label} className={ok ? "text-emerald-400" : "text-muted-foreground"}>
            {ok ? "✓" : "○"} {r.label}
          </li>
        );
      })}
    </ul>
  );
}