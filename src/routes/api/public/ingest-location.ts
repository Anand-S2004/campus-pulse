// POST /api/public/ingest-location
// Called by the Expo app (background task) and web app every ~5 minutes.
// Body: { lat: number, lon: number }
// Header: Authorization: Bearer <user JWT>
//
// PRIVACY: raw lat/lon NEVER touches storage.
// We resolve the closest zone within its radius and insert ONLY (user_id, zone_id, occurred_at).
// Response: { matched: true, zone_name: string } | { matched: false }

import { createFileRoute } from "@tanstack/react-router";

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

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export const Route = createFileRoute("/api/public/ingest-location")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1) Verify bearer token and identify the user.
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.replace(/^Bearer\s+/i, "").trim();
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData?.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        // 2) Parse body — discard everything except lat/lon.
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const lat = Number((body as { lat?: unknown })?.lat);
        const lon = Number((body as { lon?: unknown })?.lon);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return new Response("lat/lon required", { status: 400 });
        }

        // 3) Load zones.
        const { data: zones, error: zonesErr } = await supabaseAdmin
          .from("campus_zones")
          .select("id, name, center_lat, center_lon, radius_m");

        if (zonesErr) {
          console.error("Failed to load campus zones:", zonesErr);
          return new Response("Failed to load zones", { status: 500 });
        }

        // 4) Pick the closest zone within radius.
        let best: { id: string; name: string; d: number } | null = null;

        for (const z of zones ?? []) {
          const d = distanceMeters(lat, lon, z.center_lat, z.center_lon);
          if (d <= z.radius_m && (!best || d < best.d)) {
            best = { id: z.id, name: z.name, d };
          }
        }

        if (!best) {
          // Off-campus / no matching zone — drop silently.
          // Raw coordinates are never stored.
          return json({ matched: false });
        }

        // 5) Deduplicate repeated hits in the same zone.
        // If the user is still in the same zone within the dedupe window, skip insert.
        // This turns repeated "Library, Library, Library..." polls into one visit.
        const DEDUPE_MINUTES = 45;
        const dedupeWindowMs = DEDUPE_MINUTES * 60 * 1000;
        const now = new Date();

        const { data: lastEvent, error: lastEventErr } = await supabaseAdmin
          .from("location_events")
          .select("id, zone_id, occurred_at")
          .eq("user_id", userData.user.id)
          .eq("zone_id", best.id)
          .order("occurred_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastEventErr) {
          console.error("Failed to load last location event:", lastEventErr);
          return new Response("Failed to check dedupe", { status: 500 });
        }

        const lastOccurredAt = lastEvent?.occurred_at ? new Date(lastEvent.occurred_at) : null;
        const isDuplicate =
          lastOccurredAt !== null && !Number.isNaN(lastOccurredAt.getTime())
            ? now.getTime() - lastOccurredAt.getTime() < dedupeWindowMs
            : false;

        if (!isDuplicate) {
          const { error: insertErr } = await supabaseAdmin.from("location_events").insert({
            user_id: userData.user.id,
            zone_id: best.id,
            occurred_at: now.toISOString(),
          });

          if (insertErr) {
            console.error("Failed to insert location event:", insertErr);
            return new Response("Failed to save location event", { status: 500 });
          }
        }

        // 6) Return matched zone.
        return json(
          isDuplicate
            ? { matched: true, zone_name: best.name, deduped: true }
            : { matched: true, zone_name: best.name }
        );
      },
    },
  },
});