// /  (under _authenticated) — Chronological feed of approved posts + Community Pulse cards on top.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Feed · Campus Pulse" }] }),
  component: FeedPage,
});

const CATEGORY_ICON: Record<string, string> = {
  sports: "🏀",
  kindness: "🐕",
  academic: "📚",
  food: "🍔",
  music: "🎵",
  social: "🎉",
  other: "✨",
};

function FeedPage() {
  // Pulse cards — top of feed
  const pulse = useQuery({
    queryKey: ["pulse"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pulse_cards" as never)
        .select("id, body, kind, generated_for")
        .order("generated_for" as never, { ascending: false })
        .limit(3);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; body: string; kind: string }>;
    },
  });

  // Approved posts, chronological (newest first)
  const posts = useQuery({
    queryKey: ["posts-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts" as never)
        .select("id, category, location_label, description, created_at, user_id, profiles(display_name)")
        .eq("status" as never, "approved" as never)
        .order("created_at" as never, { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        category: string;
        location_label: string;
        description: string;
        created_at: string;
        profiles: { display_name: string | null } | null;
      }>;
    },
  });

  return (
    <div className="space-y-4">
      {/* Community Pulse cards */}
      {pulse.data && pulse.data.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          {pulse.data.map((p) => (
            <Card key={p.id} className="bg-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" /> Community Pulse
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">{p.body}</CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Chronological feed */}
      <div className="space-y-3">
        {posts.isLoading && <div className="text-muted-foreground">Loading feed…</div>}
        {posts.data?.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            No approved moments yet.
          </div>
        )}
        {posts.data?.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex gap-3 p-4">
              <div className="text-2xl">{CATEGORY_ICON[p.category] ?? "✨"}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary" className="capitalize">{p.category}</Badge>
                  <span>{p.location_label}</span>
                  <span>·</span>
                  <span>{new Date(p.created_at).toLocaleString()}</span>
                </div>
                <div className="mt-1 text-foreground">{p.description}</div>
                <div className="mt-1 text-xs text-muted-foreground">— {p.profiles?.display_name ?? "Anon"}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
