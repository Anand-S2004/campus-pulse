// POST /api/public/ingest-location
// Called by the Expo app every ~5 minutes in the background.
// Body: { lat: number, lon: number }
// Header: Authorization: Bearer <user JWT>
//
// PRIVACY: raw lat/lon NEVER touches storage.
// We resolve the closest zone within its radius and insert ONLY (user_id, zone_id, occurred_at).
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Haversine distance in meters — used to find the nearest zone.
function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const Route = createFileRoute("/api/public/ingest-location")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Verify the bearer token to identify the user.
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        // Lazy-import the admin client (this route file ships to the client bundle).
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });

        // 2. Parse body — discard everything except lat/lon.
        let body: { lat?: number; lon?: number };
        try {
          body = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        const lat = Number(body.lat);
        const lon = Number(body.lon);
        if (!isFinite(lat) || !isFinite(lon)) {
          return new Response("lat/lon required", { status: 400 });
        }

        // 3. Load zones, pick the closest one within its radius.
        const { data: zones } = await supabaseAdmin
          .from("campus_zones")
          .select("id,name,center_lat,center_lon,radius_m");

        let best: { id: string; d: number } | null = null;
        for (const z of zones ?? []) {
          const d = distanceMeters(lat, lon, z.center_lat, z.center_lon);
          if (d <= z.radius_m && (!best || d < best.d)) best = { id: z.id, d };
        }

        if (!best) {
          // Off-campus / no matching zone — drop silently. Raw coords still discarded.
          return Response.json({ matched: false });
        }

        // 4. Insert ONLY (user_id, zone_id, occurred_at). Raw coords are now gone forever.
        await supabaseAdmin.from("location_events").insert({
          user_id: userData.user.id,
          zone_id: best.id,
        });

        return Response.json({ matched: true });
      },
    },
  },
});
