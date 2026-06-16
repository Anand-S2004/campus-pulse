// /recap — personalised weekly recap card (the real product).
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/recap")({
  head: () => ({ meta: [{ title: "My Week · Campus Pulse" }] }),
  component: RecapPage,
});

function RecapPage() {
  const recap = useQuery({
    queryKey: ["my-recap"],
    queryFn: async () => {
      // RLS limits to current user; latest week first
      const { data, error } = await supabase
        .from("weekly_recaps" as never)
        .select("week_start, positive_moments, nearby_moments, zones_visited, crossed_paths, top_zone")
        .order("week_start" as never, { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as null | {
        week_start: string; positive_moments: number; nearby_moments: number;
        zones_visited: number; crossed_paths: number; top_zone: string | null;
      };
    },
  });

  if (recap.isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (!recap.data) {
    return (
      <Card>
        <CardContent className="p-6 text-muted-foreground">
          Your first recap will appear after Monday. Keep the app open occasionally so we can
          anonymously detect which campus zones you visit.
        </CardContent>
      </Card>
    );
  }

  const r = recap.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Week · {new Date(r.week_start).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-base">
        <p>• {r.positive_moments} positive moments happened.</p>
        <p>• You spent time near {r.nearby_moments} of them.</p>
        <p>• You visited {r.zones_visited} campus areas.</p>
        <p>• You crossed paths with ~{r.crossed_paths} students.</p>
        {r.top_zone && <p>• Most active area: <strong>{r.top_zone}</strong>.</p>}
      </CardContent>
    </Card>
  );
}
