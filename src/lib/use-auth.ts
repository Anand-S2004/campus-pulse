// Tiny client-side auth hook used by the admin UI.
// Subscribes once to Supabase auth state and exposes { user, role, loading }.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type Role = "admin" | "moderator" | "student" | null;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Synchronous listener first (per Supabase best-practice) — never async inside.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        // Fetch role outside the listener
        setTimeout(() => loadRole(session.user.id), 0);
      } else {
        setRole(null);
      }
    });

    // Then check existing session
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadRole(data.session.user.id);
      setLoading(false);
    });

    async function loadRole(uid: string) {
      // user_roles RLS lets a user read their own roles
      const { data } = await supabase
        .from("user_roles" as never)
        .select("role")
        .eq("user_id" as never, uid as never);
      const roles = (data ?? []) as { role: Role }[];
      // Priority: admin > moderator > student
      if (roles.some((r) => r.role === "admin")) setRole("admin");
      else if (roles.some((r) => r.role === "moderator")) setRole("moderator");
      else setRole("student");
    }

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, role, loading };
}
