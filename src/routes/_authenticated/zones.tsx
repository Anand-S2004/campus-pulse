// /zones — admin-only campus zone editor (name + center lat/lon + radius_m).
// RLS lets only admins write; UI hides the form for non-admins.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/zones")({
  head: () => ({ meta: [{ title: "Zones · Campus Pulse" }] }),
  component: ZonesPage,
});

function ZonesPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", short_code: "", center_lat: "", center_lon: "", radius_m: "80" });

  const zones = useQuery({
    queryKey: ["zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campus_zones" as never)
        .select("id, name, short_code, center_lat, center_lon, radius_m")
        .order("name" as never);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; name: string; short_code: string | null;
        center_lat: number; center_lon: number; radius_m: number;
      }>;
    },
  });

  if (role !== "admin") {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Campus zones</h2>
        <p className="text-sm text-muted-foreground">Read-only (admin to edit).</p>
        <ZoneList zones={zones.data ?? []} />
      </div>
    );
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("campus_zones" as never).insert({
      name: form.name,
      short_code: form.short_code || null,
      center_lat: Number(form.center_lat),
      center_lon: Number(form.center_lon),
      radius_m: Number(form.radius_m),
    } as never);
    if (error) return toast.error(error.message);
    toast.success("Zone added");
    setForm({ name: "", short_code: "", center_lat: "", center_lon: "", radius_m: "80" });
    qc.invalidateQueries({ queryKey: ["zones"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("campus_zones" as never).delete().eq("id" as never, id as never);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["zones"] });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4">
          <form onSubmit={create} className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            <div className="sm:col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><Label>Code</Label><Input value={form.short_code} onChange={(e) => setForm({ ...form, short_code: e.target.value })} /></div>
            <div><Label>Lat</Label><Input value={form.center_lat} onChange={(e) => setForm({ ...form, center_lat: e.target.value })} required type="number" step="0.000001" /></div>
            <div><Label>Lon</Label><Input value={form.center_lon} onChange={(e) => setForm({ ...form, center_lon: e.target.value })} required type="number" step="0.000001" /></div>
            <div><Label>Radius m</Label><Input value={form.radius_m} onChange={(e) => setForm({ ...form, radius_m: e.target.value })} required type="number" /></div>
            <div className="sm:col-span-6"><Button type="submit">Add zone</Button></div>
          </form>
        </CardContent>
      </Card>

      <ZoneList zones={zones.data ?? []} onDelete={remove} />
    </div>
  );
}

function ZoneList({
  zones,
  onDelete,
}: {
  zones: Array<{ id: string; name: string; short_code: string | null; center_lat: number; center_lon: number; radius_m: number }>;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {zones.map((z) => (
        <Card key={z.id}>
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <div className="font-medium">{z.name} {z.short_code && <span className="text-xs text-muted-foreground">({z.short_code})</span>}</div>
              <div className="text-xs text-muted-foreground">
                {z.center_lat.toFixed(5)}, {z.center_lon.toFixed(5)} · {z.radius_m} m
              </div>
            </div>
            {onDelete && <Button size="sm" variant="outline" onClick={() => onDelete(z.id)}>Delete</Button>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
