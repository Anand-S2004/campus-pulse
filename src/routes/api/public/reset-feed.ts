// POST /api/public/reset-feed
// Deletes posts for demo/testing purposes.
// - Admin: deletes ALL posts across all users (full demo reset).
// - Regular user: deletes only their own posts.
// Uses the service-role client to bypass RLS.
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

        const userId = userData.user.id;

        // Check if the caller is an admin — admins clear ALL posts for a full
        // demo reset; regular users only clear their own.
        const { data: roleRow } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();

        const isAdmin = !!roleRow;

        let deleteQuery = supabaseAdmin.from("posts").delete();
        if (isAdmin) {
          // Delete every post (full demo wipe). Use a filter that matches all
          // rows — Supabase requires at least one .filter() for delete.
          deleteQuery = deleteQuery.gte(
            "created_at",
            "2000-01-01T00:00:00.000Z",
          );
        } else {
          deleteQuery = deleteQuery.eq("user_id", userId);
        }

        const { error } = await deleteQuery;

        if (error) {
          console.error("Failed to reset feed:", error);
          return Response.json(
            { error: "Could not reset feed. Please try again." },
            { status: 500 },
          );
        }

        return Response.json({ ok: true, isAdmin });
      },
    },
  },
});
