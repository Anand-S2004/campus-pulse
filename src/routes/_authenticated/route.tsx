// Pathless layout protecting all routes under /_authenticated/*.
// Redirects to /auth if no session. Renders top nav + location tracking banner.
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/use-auth";
import { useLocation } from "@/lib/use-location";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, MapPinOff, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user, role, loading } = useAuth();
  const nav = useNavigate();
  const { status, currentZone, locationError, startTracking, stopTracking } = useLocation();

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!user) {
    nav({ to: "/auth", replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          {/* Left: logo + nav */}
          <div className="flex items-center gap-6">
            <Link to="/" className="font-semibold">
              Campus Pulse
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link
                to="/"
                className="hover:underline"
                activeProps={{ className: "font-semibold underline" }}
              >
                Feed
              </Link>
              <Link
                to="/recap"
                className="hover:underline"
                activeProps={{ className: "font-semibold underline" }}
              >
                My Week
              </Link>
              {(role === "moderator" || role === "admin") && (
                <Link
                  to="/moderate"
                  className="hover:underline"
                  activeProps={{ className: "font-semibold underline" }}
                >
                  Moderate
                </Link>
              )}
              {role === "admin" && (
                <Link
                  to="/zones"
                  className="hover:underline"
                  activeProps={{ className: "font-semibold underline" }}
                >
                  Zones
                </Link>
              )}
            </nav>
          </div>

          {/* Right: location indicator + user info + sign out */}
          <div className="flex items-center gap-3 text-sm">
            {/* Location indicator */}
            <LocationButton
              status={status}
              currentZone={currentZone}
              onStart={startTracking}
              onStop={stopTracking}
            />

            {role && <Badge variant="secondary">{role}</Badge>}
            <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
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

        {/* Location permission banner — shown only when denied */}
        {status === "denied" && (
          <div className="border-t bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            📍 {locationError ?? "Location access was denied."} Zone tracking is disabled — your recap stats won't update.
          </div>
        )}
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

function LocationButton({
  status,
  currentZone,
  onStart,
  onStop,
}: {
  status: ReturnType<typeof useLocation>["status"];
  currentZone: string | null;
  onStart: () => void;
  onStop: () => void;
}) {
  if (status === "unsupported") return null;

  if (status === "requesting") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Locating…
      </span>
    );
  }

  if (status === "tracking") {
    return (
      <button
        onClick={onStop}
        title="Click to stop sharing location"
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
      >
        <MapPin className="h-3 w-3" />
        {currentZone ?? "On campus"}
      </button>
    );
  }

  if (status === "denied") {
    return (
      <span
        title="Location access denied — enable in browser settings"
        className="flex items-center gap-1 text-xs text-muted-foreground"
      >
        <MapPinOff className="h-3 w-3" />
      </span>
    );
  }

  // idle / error — show a subtle share-location button
  return (
    <button
      onClick={onStart}
      title="Share your approximate campus zone"
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <MapPin className="h-3 w-3" />
      <span className="hidden sm:inline">Share zone</span>
    </button>
  );
}
