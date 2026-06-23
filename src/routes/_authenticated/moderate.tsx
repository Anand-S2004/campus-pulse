// /moderate — pending-post queue for moderators & admins.
// Approve / Reject buttons. RLS makes sure students can't touch this even if they navigate.
// NOTE: useQuery must be called unconditionally (React Rules of Hooks).
//       We use `enabled: isAuthorized` to skip the query for non-mods.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock } from "lucide-react";

type PendingPost = {
  id: string;
  category: string;
  location_label: string;
  description: string;
  created_at: string;
  profiles: { display_name: string | null; email: string } | null;
};

export const Route = createFileRoute("/_authenticated/moderate")({
  head: () => ({ meta: [{ title: "Moderate · Campus Pulse" }] }),
  component: ModeratePage,
});

function ModeratePage() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const isAuthorized = role === "moderator" || role === "admin";

  // Always call hooks — use `enabled` to skip the fetch for non-mods
  const pending = useQuery({
    queryKey: ["pending-posts"],
    enabled: isAuthorized,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts" as never)
        .select(
          "id, category, location_label, description, created_at, user_id, profiles(display_name, email)",
        )
        .eq("status" as never, "pending" as never)
        .order("created_at" as never, { ascending: true });
      if (error) throw error;
      return (data ?? []) as PendingPost[];
    },
  });

  async function decide(id: string, status: "approved" | "rejected") {
    const { error } = await supabase
      .from("posts" as never)
      .update({
        status,
        approved_at: status === "approved" ? new Date().toISOString() : null,
        approved_by: user!.id,
      } as never)
      .eq("id" as never, id as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "approved" ? "✅ Approved" : "🗑️ Rejected");
    qc.invalidateQueries({ queryKey: ["pending-posts"] });
  }

  // Guard after all hooks
  if (role === null) {
    return <div className="text-muted-foreground">Loading…</div>;
  }
  if (!isAuthorized) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        You need a <strong>moderator</strong> or <strong>admin</strong> role to view this page.
        Ask an admin to promote you via Supabase SQL Editor.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pending posts</h2>
        {pending.data && pending.data.length > 0 && (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            {pending.data.length} waiting
          </Badge>
        )}
      </div>

      {pending.isLoading && (
        <div className="text-muted-foreground">Loading queue…</div>
      )}

      {pending.isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load: {(pending.error as Error).message}
        </div>
      )}

      {!pending.isLoading && pending.data?.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <CheckCircle className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p className="font-medium">Queue is empty 🎉</p>
          <p className="text-sm">All posts have been reviewed.</p>
        </div>
      )}

      {pending.data?.map((p) => (
        <Card key={p.id}>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="capitalize">
                {p.category}
              </Badge>
              {p.location_label && <span>📍 {p.location_label}</span>}
              <span>·</span>
              <span>{new Date(p.created_at).toLocaleString()}</span>
              <span>·</span>
              <span className="font-medium text-foreground">
                {p.profiles?.display_name ?? p.profiles?.email ?? "Unknown"}
              </span>
            </div>
            <p className="text-foreground">{p.description}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="gap-1"
                onClick={() => decide(p.id, "approved")}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-destructive hover:bg-destructive/10"
                onClick={() => decide(p.id, "rejected")}
              >
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
