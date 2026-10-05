import { useEffect, useSyncExternalStore } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = { session: Session | null; user: User | null; loading: boolean };

// Single shared store so every component sees the same session and we never
// flip to "logged out" just because a second hook instance is still resolving.
let state: AuthState = { session: null, user: null, loading: true };
const serverSnapshot: AuthState = { session: null, user: null, loading: true };
const listeners = new Set<(s: AuthState) => void>();
let started = false;

function setState(next: Partial<AuthState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;

  supabase.auth.onAuthStateChange((event, s) => {
    if (s) {
      setState({ session: s, user: s.user, loading: false });
      return;
    }
    // Only an explicit sign-out (or a definitive user deletion) clears the
    // session. Transient nulls from INITIAL_SESSION / token refresh races used
    // to log people out on their own.
    if (event === "SIGNED_OUT") {
      setState({ session: null, user: null, loading: false });
    }
  });

  supabase.auth
    .getSession()
    .then(({ data: { session: s } }) => {
      if (s) setState({ session: s, user: s.user, loading: false });
      else setState({ loading: false });
    })
    .catch(() => setState({ loading: false }));
}

export function useAuth() {
  const local = useSyncExternalStore(
    (notify) => {
      const listener = () => notify();
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    () => state,
    () => serverSnapshot,
  );
  useEffect(() => { start(); }, []);
  return { ...local, isAuthenticated: !!local.user };
}

export async function signOut() {
  await supabase.auth.signOut();
  setState({ session: null, user: null, loading: false });
}
