// POST /api/public/cron/notify-approvals
// Runs every 5 min. Finds posts approved in the last 5 min that haven't been notified yet
// and pushes "Your post is live ❤️" to the author.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/notify-approvals")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expected = process.env.CRON_SECRET;
        if (!apikey || !expected || apikey !== expected) return new Response("Forbidden", { status: 403 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const since = new Date(Date.now() - 6 * 60 * 1000).toISOString();

        // Find newly approved posts
        const { data: posts } = await supabaseAdmin
          .from("posts")
          .select("id, user_id, description")
          .eq("status", "approved")
          .gte("approved_at", since);
        if (!posts?.length) return Response.json({ sent: 0 });

        const { data: tokens } = await supabaseAdmin
          .from("push_tokens")
          .select("user_id, expo_token")
          .in("user_id", posts.map((p) => p.user_id));
        if (!tokens?.length) return Response.json({ sent: 0 });

        const tokenByUser = new Map<string, string[]>();
        for (const t of tokens) {
          if (!tokenByUser.has(t.user_id)) tokenByUser.set(t.user_id, []);
          tokenByUser.get(t.user_id)!.push(t.expo_token);
        }

        const messages = posts.flatMap((p) =>
          (tokenByUser.get(p.user_id) ?? []).map((to) => ({
            to,
            title: "Your moment is live",
            body: p.description.slice(0, 120),
            sound: "default",
          })),
        );

        for (let i = 0; i < messages.length; i += 100) {
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify(messages.slice(i, i + 100)),
          }).catch(() => null);
        }
        return Response.json({ sent: messages.length });
      },
    },
  },
});
