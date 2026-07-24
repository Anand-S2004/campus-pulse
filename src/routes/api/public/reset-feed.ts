// POST /api/public/reset-feed
// Deletes all posts authored by the authenticated user (demo feed reset).
// Uses the service-role client to bypass RLS so this works regardless of
// whether the "posts self delete" Postgres policy has been applied.
//
// Header: Authorization: Bearer <user JWT>

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/reset-feed")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.replace(/^Bearer\s+/i, "").trim();
        if (!token) {
          return Response.json({ error: "Please sign in." }, { status: 401 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const { data: userData, error: userErr } =
          await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData?.user) {
          return Response.json(
            { error: "Session expired. Please sign in again." },
            { status: 401 },
          );
        }

        const { error } = await supabaseAdmin
          .from("posts")
          .delete()
          .eq("user_id", userData.user.id);

        if (error) {
          console.error("Failed to reset feed:", error);
          return Response.json(
            { error: "Could not reset feed. Please try again." },
            { status: 500 },
          );
        }

        return Response.json({ ok: true });
      },
    },
  },
});
