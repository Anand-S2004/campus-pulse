// POST /api/public/register-push-token
// Called by the Expo app on launch after `await Notifications.getExpoPushTokenAsync()`.
// Body: { token: string, platform?: 'ios'|'android' }
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/register-push-token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json().catch(() => null)) as
          | { token?: string; platform?: string }
          | null;
        if (!body?.token || !body.token.startsWith("ExponentPushToken[")) {
          return new Response("Invalid Expo push token", { status: 400 });
        }

        // Upsert by expo_token (unique). Re-points the token to the latest user.
        await supabaseAdmin
          .from("push_tokens")
          .upsert(
            {
              user_id: userData.user.id,
              expo_token: body.token,
              platform: body.platform ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "expo_token" },
          );

        return Response.json({ ok: true });
      },
    },
  },
});
