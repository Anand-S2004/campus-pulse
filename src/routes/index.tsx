// Public landing — redirect signed-in users into the app, signed-out users to /auth.
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Campus Pulse" },
      { name: "description", content: "A campus app that surfaces small positive community moments." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  // _authenticated/index lives at "/" already — when authed, this won't render
  // because TanStack matches the more specific _authenticated layout. We just
  // bounce signed-out visitors to /auth.
  if (!user) return <Navigate to="/auth" />;
  return null;
}
