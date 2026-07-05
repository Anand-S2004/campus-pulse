// POST /api/public/cron/generate-pulse
// Triggered by pg_cron once daily.
// Generates belonging-focused Community Pulse cards.

import { createFileRoute } from "@tanstack/react-router";

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export const Route = createFileRoute("/api/public/cron/generate-pulse")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        //
        // Secure cron auth
        //
        const apikey = request.headers.get("apikey");

        if (
          !apikey ||
          !process.env.CRON_SECRET ||
          apikey !== process.env.CRON_SECRET
        ) {
          return new Response("Forbidden", { status: 403 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const generatedFor = new Date().toISOString().slice(0, 10);

        //
        // Last 24h location events
        //
        const since = new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString();

        const { data: events, error: eventsErr } =
          await supabaseAdmin
            .from("location_events")
            .select(`
              user_id,
              zone_id,
              occurred_at,
              campus_zones(name)
            `)
            .gte("occurred_at", since);

        if (eventsErr) {
          console.error(eventsErr);
          return new Response("Failed loading events", {
            status: 500,
          });
        }

        type EventRow = {
          user_id: string;
          zone_id: string;
          occurred_at: string;
          campus_zones: {
            name: string;
          } | null;
        };

        const rows = (events ?? []) as unknown as EventRow[];

        //
        // Aggregate
        //
        const zoneVisits = new Map<
          string,
          {
            name: string;
            visits: number;
            users: Set<string>;
          }
        >();

        const hourCounts = new Map<number, number>();

        const activeUsers = new Set<string>();

        for (const row of rows) {
          activeUsers.add(row.user_id);

          const zoneName =
            row.campus_zones?.name ?? "Unknown";

          const zone =
            zoneVisits.get(zoneName) ??
            {
              name: zoneName,
              visits: 0,
              users: new Set<string>(),
            };

          zone.visits += 1;
          zone.users.add(row.user_id);

          zoneVisits.set(zoneName, zone);

          const hour = new Date(
            row.occurred_at
          ).getHours();

          hourCounts.set(
            hour,
            (hourCounts.get(hour) ?? 0) + 1
          );
        }

        const cards: {
          kind: string;
          body: string;
        }[] = [];

        //
        // Most shared space
        //
        const topZone = [...zoneVisits.values()].sort(
          (a, b) => b.users.size - a.users.size
        )[0];

        if (topZone) {
          cards.push({
            kind: "daily_top_zone",
            body: `${topZone.users.size} students spent part of their day around ${topZone.name}.`,
          });
        }

        //
        // Weekly approved moments
        //
        const weekStart = new Date();
        weekStart.setDate(
          weekStart.getDate() - 7
        );

        const {
          count: approvedMoments,
          error: postErr,
        } = await supabaseAdmin
          .from("posts")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("status", "approved")
          .gte(
            "created_at",
            weekStart.toISOString()
          );

        if (postErr) {
          console.error(postErr);

          return new Response(
            "Failed counting posts",
            {
              status: 500,
            }
          );
        }

        if (approvedMoments && approvedMoments > 0) {
          cards.push({
            kind: "weekly_total",
            body: `${approvedMoments} positive community moments were shared this week.`,
          });
        }

        //
        // Community participation card
        //
        if (activeUsers.size > 0) {
          cards.push({
            kind: "community_participation",
            body: `${activeUsers.size} students contributed to the rhythm of campus during the last day.`,
          });
        }

        //
        // Peak activity card
        //
        const peakHour = [...hourCounts.entries()].sort(
          (a, b) => b[1] - a[1]
        )[0];

        if (peakHour) {
          const hour = peakHour[0];

          const display = `${((hour + 11) % 12) + 1} ${
            hour < 12 ? "AM" : "PM"
          }`;

          cards.push({
            kind: "peak_hour",
            body: `Campus felt most alive around ${display}.`,
          });
        }

        //
        // Nothing generated
        //
        if (cards.length === 0) {
          return json({
            generated: 0,
          });
        }

        //
        // Idempotent insert
        //
        const { error: upsertErr } =
          await supabaseAdmin
            .from("pulse_cards")
            .upsert(
              cards.map((card) => ({
                ...card,
                generated_for: generatedFor,
              })),
              {
                onConflict:
                  "kind,generated_for",
              }
            );

        if (upsertErr) {
          console.error(upsertErr);

          return new Response(
            "Failed saving pulse cards",
            {
              status: 500,
            }
          );
        }

        return json({
          generated: cards.length,
        });
      },
    },
  },
});