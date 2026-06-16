// /moderate — pending-post queue for moderators & admins.
// Approve / Reject buttons. RLS makes sure students can't reach this even if they navigate.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/moderate")({
  head: () => ({ meta: [{ title: "Moderate · Campus Pulse" }] }),
  component: ModeratePage,
});

function ModeratePage() {
  const { user, role } = useAuth();
  const qc = useQueryClient();

  if (role !== "moderator" && role !== "admin") {
    return <div className="text-muted-foreground">Moderators only.</div>;
  }

  const pending = useQuery({
    queryKey: ["pending-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts" as never)
        .select("id, category, location_label, description, created_at, user_id, profiles(display_name, email)")
        .eq("status" as never, "pending" as never)
        .order("created_at" as never, { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        category: string;
        location_label: string;
        description: string;
        created_at: string;
        profiles: { display_name: string | null; email: string } | null;
      }>;
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
    toast.success(status === "approved" ? "Approved" : "Rejected");
    qc.invalidateQueries({ queryKey: ["pending-posts"] });
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Pending posts</h2>
      {pending.isLoading && <div className="text-muted-foreground">Loading…</div>}
      {pending.data?.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Queue is empty 🎉
        </div>
      )}
      {pending.data?.map((p) => (
        <Card key={p.id}>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="capitalize">{p.category}</Badge>
              <span>{p.location_label}</span>
              <span>·</span>
              <span>{new Date(p.created_at).toLocaleString()}</span>
              <span>·</span>
              <span>{p.profiles?.display_name ?? p.profiles?.email}</span>
            </div>
            <div className="text-foreground">{p.description}</div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => decide(p.id, "approved")}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => decide(p.id, "rejected")}>Reject</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
