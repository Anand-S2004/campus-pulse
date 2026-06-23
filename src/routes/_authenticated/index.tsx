// / (under _authenticated) — Feed of approved posts + Create Post + user's own pending posts.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, Plus, Clock, XCircle } from "lucide-react";

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

const CATEGORIES = [
  "sports",
  "kindness",
  "academic",
  "food",
  "music",
  "social",
  "other",
] as const;

type Post = {
  id: string;
  category: string;
  location_label: string;
  description: string;
  created_at: string;
  status: string;
  user_id: string;
  profiles: { display_name: string | null } | null;
};

type Zone = { id: string; name: string };

function CreatePostDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [zoneId, setZoneId] = useState("");

  const zones = useQuery({
    queryKey: ["campus-zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campus_zones" as never)
        .select("id, name")
        .order("name" as never, { ascending: true });
      if (error) throw error;
      return (data ?? []) as Zone[];
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) { toast.error("Pick a category."); return; }
    if (!description.trim()) { toast.error("Write something!"); return; }
    if (!locationLabel.trim()) { toast.error("Add a location label."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("posts" as never).insert({
        user_id: user!.id,
        category,
        description: description.trim(),
        location_label: locationLabel.trim(),
        zone_id: zoneId || null,
        status: "pending",
      } as never);
      if (error) {
        // Friendly message for the weekly-limit trigger
        if (error.message.includes("Weekly post limit")) {
          throw new Error("You've reached your 2 posts/week limit. Try again next week!");
        }
        throw error;
      }
      toast.success("Moment shared! It'll appear after review.");
      setOpen(false);
      setCategory("");
      setDescription("");
      setLocationLabel("");
      setZoneId("");
      onCreated();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" size="sm">
          <Plus className="h-4 w-4" />
          Share a moment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share a campus moment</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger>
                <SelectValue placeholder="Pick a category…" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_ICON[c]} {c.charAt(0).toUpperCase() + c.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              What happened?{" "}
              <span className={description.length > 260 ? "text-destructive" : "text-muted-foreground"}>
                {description.length}/280
              </span>
            </Label>
            <textarea
              id="description"
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={3}
              maxLength={280}
              placeholder="Describe the moment… (max 280 chars)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location label</Label>
            <Input
              id="location"
              placeholder="e.g. Near the Library"
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Campus zone (optional)</Label>
            <Select value={zoneId} onValueChange={setZoneId}>
              <SelectTrigger>
                <SelectValue placeholder="Select zone…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {zones.data?.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            Posts are reviewed before appearing in the feed. Limit: 2 per week.
          </p>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Submitting…" : "Submit for review"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FeedPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Community Pulse cards
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

  // Approved posts — full community feed
  const posts = useQuery({
    queryKey: ["posts-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts" as never)
        .select("id, category, location_label, description, created_at, status, user_id, profiles(display_name)")
        .eq("status" as never, "approved" as never)
        .order("created_at" as never, { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Post[];
    },
  });

  // User's own pending / rejected posts
  const myPending = useQuery({
    queryKey: ["my-posts"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts" as never)
        .select("id, category, location_label, description, created_at, status")
        .eq("user_id" as never, user!.id as never)
        .in("status" as never, ["pending", "rejected"] as never)
        .order("created_at" as never, { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Post[];
    },
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["posts-feed"] });
    qc.invalidateQueries({ queryKey: ["my-posts"] });
  }

  return (
    <div className="space-y-5">
      {/* Top row: title + create button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Campus Feed</h2>
        <CreatePostDialog onCreated={invalidate} />
      </div>

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

      {/* User's own pending / rejected posts */}
      {myPending.data && myPending.data.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">My submissions</h3>
          {myPending.data.map((p) => (
            <Card key={p.id} className="border-dashed opacity-80">
              <CardContent className="flex gap-3 p-3">
                <div className="text-xl">{CATEGORY_ICON[p.category] ?? "✨"}</div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge
                      variant={p.status === "rejected" ? "destructive" : "secondary"}
                      className="capitalize gap-1"
                    >
                      {p.status === "pending" ? (
                        <Clock className="h-2.5 w-2.5" />
                      ) : (
                        <XCircle className="h-2.5 w-2.5" />
                      )}
                      {p.status}
                    </Badge>
                    <span>{p.location_label}</span>
                    <span>·</span>
                    <span>{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{p.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approved post feed */}
      <div className="space-y-3">
        {posts.isLoading && (
          <div className="text-muted-foreground">Loading feed…</div>
        )}
        {!posts.isLoading && posts.data?.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            <p>No moments yet.</p>
            <p className="text-sm">Be the first to share something!</p>
          </div>
        )}
        {posts.data?.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex gap-3 p-4">
              <div className="text-2xl">{CATEGORY_ICON[p.category] ?? "✨"}</div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary" className="capitalize">
                    {p.category}
                  </Badge>
                  {p.location_label && <span>📍 {p.location_label}</span>}
                  <span>·</span>
                  <span>{new Date(p.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-foreground">{p.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  — {p.profiles?.display_name ?? "Anon"}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
