// POST /api/public/cron/push-recaps
// Sends weekly recap notifications.
// Body: { week_start: 'YYYY-MM-DD' }

import { createFileRoute } from "@tanstack/react-router";

type RecapRow = {
  user_id: string;
  positive_moments: number;
  top_zone: string | null;
  narrative: string | null;
};

type PushTokenRow = {
  user_id: string;
  expo_token: string;
};

type ExpoTicket = {
  status?: string;
  details?: {
    error?: string;
  };
};

export const Route = createFileRoute("/api/public/cron/push-recaps")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");

        if (!apikey || apikey !== process.env.CRON_SECRET) {
          return new Response("Forbidden", { status: 403 });
        }

        const body = (await request.json().catch(() => ({}))) as {
          week_start?: string;
        };

        const weekStart = body.week_start?.trim();

        if (!weekStart) {
          return new Response("week_start required", { status: 400 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const { data: recaps, error: recapError } = await supabaseAdmin
          .from("weekly_recaps")
          .select(
            `
            user_id,
            positive_moments,
            top_zone,
            narrative
          `
          )
          .eq("week_start", weekStart)
          .is("recap_notification_sent_at", null);

        if (recapError) {
          console.error("Failed loading recaps", recapError);

          return Response.json(
            {
              error: "Failed loading recaps",
            },
            { status: 500 }
          );
        }

        const recapRows = (recaps ?? []) as unknown as RecapRow[];

        if (recapRows.length === 0) {
          return Response.json({
            sent: 0,
            invalid_tokens_removed: 0,
          });
        }

        const userIds = [...new Set(recapRows.map((r) => r.user_id))];

        const { data: tokens, error: tokenError } = await supabaseAdmin
          .from("push_tokens")
          .select("user_id, expo_token")
          .in("user_id", userIds);

        if (tokenError) {
          console.error("Failed loading push tokens", tokenError);

          return Response.json(
            {
              error: "Failed loading push tokens",
            },
            { status: 500 }
          );
        }

        const tokenRows = (tokens ?? []) as PushTokenRow[];

        if (tokenRows.length === 0) {
          return Response.json({
            sent: 0,
            invalid_tokens_removed: 0,
          });
        }
        const recapByUser = new Map<string, RecapRow>();
        for (const recap of recapRows) {
          recapByUser.set(recap.user_id, recap);
        }
        for (const recap of recapRows) {
          recapByUser.set(recap.user_id, recap);
        }

        const messages = tokenRows
        .map((token) => {
          const recap = recapByUser.get(token.user_id);

          if (!recap) return null;

          if (
            !token.expo_token.startsWith("ExponentPushToken[") &&
            !token.expo_token.startsWith("ExpoPushToken[")
          ) {
            return null;
          }

          let body =
            recap.narrative ??
            (recap.top_zone
              ? `${recap.positive_moments} positive moments happened this week. ${recap.top_zone} was one of your most visited places.`
              : `${recap.positive_moments} positive moments happened on campus this week.`);

          if (body.length > 180) {
            const cut = body.lastIndexOf(" ", 180);
            body = (cut > 0 ? body.slice(0, cut) : body.slice(0, 180)) + "...";
          }

          return {
            to: token.expo_token,
            title: "Your Week on Campus",
            body,
            sound: "default",
            priority: "high",
            channelId: "default",
            badge: 1,

            data: {
              screen: "weekly-recap",
              weekStart,
              type: "weekly_recap",
            },
          };
        })
        .filter(
          (
            m
          ): m is {
            to: string;
            title: string;
            body: string;
            sound: string;
            priority: string;
            channelId: string;
            badge: number;
            data: {
              screen: string;
              weekStart: string;
              type: string;
            };
          } => m !== null
        );
        if (messages.length === 0) {
          return Response.json({
            sent: 0,
            invalid_tokens_removed: 0,
          });
        }
        let successful = 0;
        const invalidTokens = new Set<string>();

        for (let i = 0; i < messages.length; i += 100) {
          const batch = messages.slice(i, i + 100);

          try {
            const res = await fetch(
              "https://exp.host/--/api/v2/push/send",
              {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  accept: "application/json",
                },
                body: JSON.stringify(batch),
              }
            );

            if (!res.ok) {
              console.error(
                "Expo push failed",
                res.status,
                await res.text()
              );
              continue;
            }

            const result = await res.json();

            const tickets = (result?.data ?? []) as ExpoTicket[];

            for (let j = 0; j < tickets.length; j++) {
              const ticket = tickets[j];

              if (ticket?.status === "ok") {
                successful++;
                continue;
              }

              if (ticket?.status === "error") {
                console.error("Expo ticket error", ticket.details);
              }

              if (ticket?.details?.error === "DeviceNotRegistered") {
                const tokenTo = batch[j]?.to;

                if (tokenTo) {
                  invalidTokens.add(tokenTo);
                }
              }
            }
          } catch (err) {
            console.error("Expo push batch failed", err);
          }
        }

        if (invalidTokens.size > 0) {
          const { error } = await supabaseAdmin
            .from("push_tokens")
            .delete()
            .in("expo_token", [...invalidTokens]);

          if (error) {
            console.error(
              "Failed removing invalid push tokens",
              error
            );
          }
        }

        const { error: updateError } = await supabaseAdmin
          .from("weekly_recaps")
          .update(
            {
              recap_notification_sent_at: new Date().toISOString(),
            } as { recap_notification_sent_at: string }
          )
          .eq("week_start", weekStart)
          .is("recap_notification_sent_at", null);

        if (updateError) {
          console.error(
            "Failed updating recap notification state",
            updateError
          );
        }

        return Response.json({
          sent: successful,
          attempted: messages.length,
          users: recapRows.length,
          tokens: tokenRows.length,
          week_start: weekStart,
          invalid_tokens_removed: invalidTokens.size,
        });
      },
    },
  },
});