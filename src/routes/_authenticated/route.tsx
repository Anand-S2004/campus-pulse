// Pathless layout protecting all routes under /_authenticated/*.
// Redirects to /auth if no session. Also renders the top nav.
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated")({
  ssr: false, // session lives in localStorage; server can't read it
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user, role, loading } = useAuth();
  const nav = useNavigate();

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!user) {
    // Inline client-only redirect (avoids redirect loops during ssr:false)
    nav({ to: "/auth", replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-semibold">
              Campus Pulse
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link to="/" className="hover:underline" activeProps={{ className: "font-semibold underline" }}>
                Feed
              </Link>
              <Link to="/recap" className="hover:underline" activeProps={{ className: "font-semibold underline" }}>
                My Week
              </Link>
              {(role === "moderator" || role === "admin") && (
                <Link to="/moderate" className="hover:underline" activeProps={{ className: "font-semibold underline" }}>
                  Moderate
                </Link>
              )}
              {role === "admin" && (
                <Link to="/zones" className="hover:underline" activeProps={{ className: "font-semibold underline" }}>
                  Zones
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {role && <Badge variant="secondary">{role}</Badge>}
            <span className="text-muted-foreground hidden sm:inline">{user.email}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                nav({ to: "/auth", replace: true });
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
