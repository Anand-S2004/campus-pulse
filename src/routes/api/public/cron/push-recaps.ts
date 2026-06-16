// POST /api/public/cron/push-recaps
// Sends an Expo push notification to every user who has a recap for the given week.
// Body: { week_start: 'YYYY-MM-DD' }
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/push-recaps")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey) return new Response("Forbidden", { status: 403 });

        const body = (await request.json().catch(() => ({}))) as { week_start?: string };
        const weekStart = body.week_start;
        if (!weekStart) return new Response("week_start required", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Recaps + push tokens joined by user_id
        const { data: recaps } = await supabaseAdmin
          .from("weekly_recaps")
          .select("user_id, positive_moments, top_zone")
          .eq("week_start", weekStart);
        if (!recaps?.length) return Response.json({ sent: 0 });

        const { data: tokens } = await supabaseAdmin
          .from("push_tokens")
          .select("user_id, expo_token")
          .in("user_id", recaps.map((r) => r.user_id));

        const byUser = new Map((recaps ?? []).map((r) => [r.user_id, r]));
        const messages = (tokens ?? [])
          .map((t) => {
            const r = byUser.get(t.user_id);
            if (!r) return null;
            return {
              to: t.expo_token,
              title: "Your Week on Campus",
              body: `${r.positive_moments} positive moments happened${r.top_zone ? `. Most active: ${r.top_zone}` : ""}.`,
              sound: "default",
            };
          })
          .filter(Boolean);

        if (messages.length === 0) return Response.json({ sent: 0 });

        // Expo push API: batches of 100
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
