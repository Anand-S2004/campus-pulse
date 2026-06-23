// /zones — Campus zone management (admin) + live zone occupancy view.
// Zone occupancy requires the "location admin read" RLS policy (migration 20260622000001).
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MapPin, Users, Trash2, RefreshCw } from "lucide-react";

type Zone = {
  id: string;
  name: string;
  short_code: string | null;
  center_lat: number;
  center_lon: number;
  radius_m: number;
};

export const Route = createFileRoute("/_authenticated/zones")({
  head: () => ({ meta: [{ title: "Zones · Campus Pulse" }] }),
  component: ZonesPage,
});

function ZonesPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const isAdmin = role === "admin";

  const [form, setForm] = useState({
    name: "",
    short_code: "",
    center_lat: "",
    center_lon: "",
    radius_m: "80",
  });
  const [busy, setBusy] = useState(false);

  const zones = useQuery({
    queryKey: ["zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campus_zones" as never)
        .select("id, name, short_code, center_lat, center_lon, radius_m")
        .order("name" as never);
      if (error) throw error;
      return (data ?? []) as Zone[];
    },
  });

  // Who's Here Now: unique users per zone in the last 30 min (admin only).
  // Requires "location admin read" policy from migration 20260622000001.
  const occupancy = useQuery({
    queryKey: ["zone-occupancy"],
    enabled: isAdmin,
    refetchInterval: 60 * 1000,
    queryFn: async () => {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("location_events" as never)
        .select("zone_id, user_id")
        .gte("occurred_at" as never, thirtyMinAgo as never);
      if (error) throw error;
      const byZone = new Map<string, Set<string>>();
      for (const ev of (data ?? []) as Array<{ zone_id: string; user_id: string }>) {
        if (!byZone.has(ev.zone_id)) byZone.set(ev.zone_id, new Set());
        byZone.get(ev.zone_id)!.add(ev.user_id);
      }
      return Object.fromEntries(
        [...byZone.entries()].map(([k, v]) => [k, v.size]),
      ) as Record<string, number>;
    },
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("campus_zones" as never).insert({
      name: form.name,
      short_code: form.short_code || null,
      center_lat: Number(form.center_lat),
      center_lon: Number(form.center_lon),
      radius_m: Number(form.radius_m),
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Zone added");
    setForm({ name: "", short_code: "", center_lat: "", center_lon: "", radius_m: "80" });
    qc.invalidateQueries({ queryKey: ["zones"] });
    qc.invalidateQueries({ queryKey: ["campus-zones"] });
  }

  async function remove(id: string, zoneName: string) {
    if (!confirm(`Delete zone "${zoneName}"? This cannot be undone.`)) return;
    const { error } = await supabase
      .from("campus_zones" as never)
      .delete()
      .eq("id" as never, id as never);
    if (error) return toast.error(error.message);
    toast.success("Zone deleted");
    qc.invalidateQueries({ queryKey: ["zones"] });
    qc.invalidateQueries({ queryKey: ["campus-zones"] });
  }

  const totalOccupied = occupancy.data
    ? Object.values(occupancy.data).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Campus Zones</h2>

      {/* ── Who's Here Now (admin only) ──────────────────────────────── */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Who's Here Now
                <Badge variant="secondary" className="ml-1">
                  {totalOccupied} in last 30 min
                </Badge>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                title="Refresh"
                onClick={() => qc.invalidateQueries({ queryKey: ["zone-occupancy"] })}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Approximate — shows zones visited in the last 30 minutes. Raw GPS is never stored.
            </p>
          </CardHeader>
          <CardContent>
            {occupancy.isLoading && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {occupancy.isError && (
              <p className="text-sm text-destructive">
                Could not load occupancy. Run migration{" "}
                <code className="font-mono text-xs">20260622000001</code> in Supabase SQL Editor first.
              </p>
            )}
            {!occupancy.isLoading && zones.data && zones.data.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {zones.data.map((z) => {
                  const count = occupancy.data?.[z.id] ?? 0;
                  return (
                    <div
                      key={z.id}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                        count > 0
                          ? "border-primary/40 bg-primary/5"
                          : "border-muted bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin
                          className={`h-3.5 w-3.5 ${count > 0 ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <span className="font-medium">{z.name}</span>
                        {z.short_code && (
                          <span className="text-xs text-muted-foreground">
                            ({z.short_code})
                          </span>
                        )}
                      </div>
                      <Badge variant={count > 0 ? "default" : "secondary"}>
                        {count} {count === 1 ? "person" : "people"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
            {!occupancy.isLoading &&
              occupancy.data &&
              Object.keys(occupancy.data).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No activity recorded in the last 30 minutes.
                </p>
              )}
          </CardContent>
        </Card>
      )}

      {/* ── Add zone (admin only) ────────────────────────────────────── */}
      {isAdmin && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={create} className="grid grid-cols-1 gap-3 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Library"
                  required
                />
              </div>
              <div>
                <Label>Code</Label>
                <Input
                  value={form.short_code}
                  onChange={(e) => setForm({ ...form, short_code: e.target.value })}
                  placeholder="LIB"
                />
              </div>
              <div>
                <Label>Lat</Label>
                <Input
                  value={form.center_lat}
                  onChange={(e) => setForm({ ...form, center_lat: e.target.value })}
                  placeholder="17.4439"
                  required
                  type="number"
                  step="0.000001"
                />
              </div>
              <div>
                <Label>Lon</Label>
                <Input
                  value={form.center_lon}
                  onChange={(e) => setForm({ ...form, center_lon: e.target.value })}
                  placeholder="78.3487"
                  required
                  type="number"
                  step="0.000001"
                />
              </div>
              <div>
                <Label>Radius m</Label>
                <Input
                  value={form.radius_m}
                  onChange={(e) => setForm({ ...form, radius_m: e.target.value })}
                  required
                  type="number"
                />
              </div>
              <div className="sm:col-span-6">
                <Button type="submit" disabled={busy}>
                  {busy ? "Adding…" : "Add zone"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Zone list ────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {zones.isLoading && <p className="text-muted-foreground">Loading zones…</p>}
        {zones.data?.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            No zones yet.
          </div>
        )}
        {zones.data?.map((z) => (
          <Card key={z.id}>
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <div className="font-medium">
                  {z.name}{" "}
                  {z.short_code && (
                    <span className="text-xs text-muted-foreground">({z.short_code})</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {z.center_lat.toFixed(5)}, {z.center_lon.toFixed(5)} · {z.radius_m} m
                </div>
              </div>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => remove(z.id, z.name)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
