// POST /api/public/ingest-location
// Called by the Expo app (background task) and web app every ~5 minutes.
// Body: { lat: number, lon: number }
// Header: Authorization: Bearer <user JWT>
//
// Does NOT require SUPABASE_SERVICE_ROLE_KEY — uses the public anon key + user JWT.
// The user's JWT is verified via the public /auth/v1/user endpoint.
// Location events are inserted with the user's JWT (RLS handles auth.uid() = user_id).
//
// PRIVACY: raw lat/lon NEVER touches storage.
// We resolve the closest zone within its radius and insert ONLY (user_id, zone_id, occurred_at).
// Response: { matched: true, zone_name: string } | { matched: false }
import { createFileRoute } from "@tanstack/react-router";

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
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_ANON_KEY =
          process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
          return new Response("Server configuration error", { status: 500 });
        }

        // 1. Verify the bearer token using the public Supabase auth endpoint.
        //    This requires only the anon key — no service role key needed.
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
          },
        });
        if (!userRes.ok) return new Response("Unauthorized", { status: 401 });

        const userJson = await userRes.json();
        const userId: string | undefined = userJson?.id;
        if (!userId) return new Response("Unauthorized", { status: 401 });

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

        // 3. Load zones with anon client (campus_zones is publicly readable).
        //    Node 20 has no native WebSocket — pass the `ws` package as transport
        //    so the Supabase realtime client doesn't throw on client creation.
        const { createClient } = await import("@supabase/supabase-js");
        const ws = (await import("ws")).default;
        const wsTransport = ws as unknown as typeof WebSocket;
        const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          realtime: { transport: wsTransport },
        });
        const { data: zones } = await anonClient
          .from("campus_zones")
          .select("id, name, center_lat, center_lon, radius_m");

        let best: { id: string; name: string; d: number } | null = null;
        for (const z of zones ?? []) {
          const d = distanceMeters(lat, lon, z.center_lat, z.center_lon);
          if (d <= z.radius_m && (!best || d < best.d)) {
            best = { id: z.id, name: z.name, d };
          }
        }

        if (!best) {
          // Off-campus / no matching zone — raw coords already discarded.
          return Response.json({ matched: false });
        }

        // 4. Insert ONLY (user_id, zone_id). Raw coords are gone forever.
        //    Uses the user's own JWT so RLS enforces auth.uid() = user_id.
        //    Requires the "location self insert" RLS policy from migration 20260622000002.
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
          realtime: { transport: wsTransport },
        });

        await userClient
          .from("location_events")
          .insert({ user_id: userId, zone_id: best.id });

        return Response.json({ matched: true, zone_name: best.name });
      },
    },
  },
});
