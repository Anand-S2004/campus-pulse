// POST /api/public/create-post
// Called by the Expo app when sharing a moment. Replaces the direct Supabase insert
// that was failing with an opaque "new row violates row-level security policy for
// table \"posts\"" error for some users (often due to stale sessions or the mobile
// bundle not picking up the status='pending' fix).
//
// This endpoint performs explicit authentication using the user's Bearer token, then
// inserts the post using the service-role client with status='pending' and the user's
// own id. It also returns a clear "Weekly post limit reached" message before the DB
// trigger fires, so users get a human-readable error instead of a cryptic RLS code.
//
// Body: { description: string, locationLabel: string, category: string }
// Header: Authorization: Bearer <user JWT>

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/create-post")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1) Authenticate the caller.
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.replace(/^Bearer\s+/i, "").trim();
        if (!token) {
          return Response.json({ error: "Please sign in before sharing." }, { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData?.user) {
          return Response.json(
            { error: "Your session expired. Please sign in again." },
            { status: 401 },
          );
        }
        const userId = userData.user.id;

        // 2) Parse and validate the body.
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request body." }, { status: 400 });
        }

        const description = String((body as { description?: unknown })?.description ?? "").trim();
        const locationLabel = String(
          (body as { locationLabel?: unknown })?.locationLabel ?? "Campus community",
        ).trim();
        const category = String((body as { category?: unknown })?.category ?? "other").trim();

        if (description.length < 1 || description.length > 280) {
          return Response.json(
            { error: "Share a brief positive moment (1–280 characters)." },
            { status: 400 },
          );
        }
        if (!locationLabel) {
          return Response.json(
            { error: "Add a simple location label so the post feels grounded." },
            { status: 400 },
          );
        }

        const validCategories = [
          "sports",
          "kindness",
          "academic",
          "food",
          "music",
          "social",
          "other",
        ];
        if (!validCategories.includes(category)) {
          return Response.json({ error: "Choose a valid category." }, { status: 400 });
        }

        // 3) Insert the post as 'pending' on behalf of the authenticated user.
        // NOTE: the historical 2-posts-per-week cap has been removed; the DB trigger
        // `posts_weekly_limit` and the helper function `enforce_weekly_post_limit()`
        // are dropped by migration 20260713000001_remove_weekly_post_limit.sql.
        const { error: insertErr } = await supabaseAdmin.from("posts").insert({
          user_id: userId,
          description,
          location_label: locationLabel,
          category,
          status: "pending",
        });

        if (insertErr) {
          console.error("Failed to insert post:", insertErr);
          // The historical DB trigger still returns this message until it is dropped
          // via migration 20260713000001_remove_weekly_post_limit.sql.
          const isWeeklyLimit =
            insertErr.message?.includes("Weekly post limit reached") ?? false;
          return Response.json(
            {
              error: isWeeklyLimit
                ? "Weekly post limit reached (2 per week). Ask the project owner to remove the cap in Supabase."
                : "Could not share your moment. Please try again.",
            },
            { status: isWeeklyLimit ? 429 : 500 },
          );
        }

        return Response.json({ ok: true }, { status: 201 });
      },
    },
  },
});

