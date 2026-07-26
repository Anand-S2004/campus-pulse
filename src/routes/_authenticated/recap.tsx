// /recap — personalised weekly recap card.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, MapPinOff, Calendar } from "lucide-react";

type Recap = {
  week_start: string;
  positive_moments: number;
  nearby_moments: number;
  zones_visited: number;
  crossed_paths: number;
  top_zone: string | null;
};

export const Route = createFileRoute("/_authenticated/recap")({
  head: () => ({ meta: [{ title: "My Week · Campus Pulse" }] }),
  component: RecapPage,
});

function RecapPage() {
  const recap = useQuery({
    queryKey: ["my-recap"],
    queryFn: async () => {
      // First try to read any existing recap for the current week.
      const now = new Date();
      const day = now.getUTCDay();
      const monday = new Date(now);
      monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
      const weekStart = monday.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("weekly_recaps")
        .select("week_start, positive_moments, nearby_moments, zones_visited, crossed_paths, top_zone")
        .eq("week_start", weekStart)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as Recap | null;
    },
  });

  async function refreshRecap(testMinutes?: number) {
    toast.info("Generating your recap…");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      toast.error("You need to be signed in.");
      return;
    }
    const res = await fetch("/api/public/my-recap", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(testMinutes ? { testMinutes } : {}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      toast.error(`Recap failed: ${text}`);
      return;
    }
    toast.success("Recap updated!");
    recap.refetch();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">My Week</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refreshRecap()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Generate / refresh
          </Button>
          <Button size="sm" variant="secondary" onClick={() => refreshRecap(60)} title="Generate recap from last 60 minutes of data (testing)">
            ⚡ Last 60 min
          </Button>
        </div>
      </div>

      {recap.isLoading && <div className="text-muted-foreground">Loading recap…</div>}

      {!recap.isLoading && !recap.data && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-amber-100 p-2 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                <MapPinOff className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-muted-foreground">
                  No recap yet. We need at least one location ping this week to build it.
                </p>
                <p className="text-sm text-muted-foreground">
                  Click the location button in the top bar to share your zone, then come back and
                  press <strong>Generate / refresh</strong>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {recap.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Week of{" "}
              {new Date(recap.data.week_start).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-base">
            <p>• {recap.data.positive_moments} positive moments happened.</p>
            <p>• You spent time near {recap.data.nearby_moments} of them.</p>
            <p>• You visited {recap.data.zones_visited} campus areas.</p>
            <p>• You crossed paths with ~{recap.data.crossed_paths} students.</p>
            {recap.data.top_zone && (
              <p>
                • Most active area: <strong>{recap.data.top_zone}</strong>.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
