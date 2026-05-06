import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, CheckCircle2, ListChecks, Package } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: () => <RequireAuth><Dashboard /></RequireAuth>,
});

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ assets: 0, mine: 0, approved: 0, pending: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [a, mine] = await Promise.all([
        supabase.from("assets").select("id", { count: "exact", head: true }),
        supabase.from("bookings").select("*, assets(name)").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(5),
      ]);
      const all = mine.data ?? [];
      setStats({
        assets: a.count ?? 0,
        mine: all.length,
        approved: all.filter((b) => b.status === "approved").length,
        pending: all.filter((b) => b.status === "pending").length,
      });
      setRecent(all);
    })();
  }, [user]);

  const cards = [
    { icon: Package, label: "Available assets", value: stats.assets },
    { icon: ListChecks, label: "My bookings", value: stats.mine },
    { icon: CheckCircle2, label: "Approved", value: stats.approved },
    { icon: CalendarClock, label: "Pending", value: stats.pending },
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your bookings and activity.</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          {cards.map((c) => (
            <Card key={c.label} className="p-5 shadow-card border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center"><c.icon className="h-5 w-5 text-primary-foreground" /></div>
                <div>
                  <div className="text-2xl font-semibold">{c.value}</div>
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent bookings</h2>
            <Link to="/bookings" className="text-sm text-primary hover:underline">View all →</Link>
          </div>
          {recent.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              No bookings yet. <Link to="/assets" className="text-primary hover:underline">Browse assets</Link>
            </Card>
          ) : (
            <div className="space-y-2">
              {recent.map((b) => (
                <Card key={b.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{b.assets?.name}</div>
                    <div className="text-sm text-muted-foreground">{new Date(b.start_time).toLocaleString()} → {new Date(b.end_time).toLocaleString()}</div>
                  </div>
                  <StatusBadge status={b.status} />
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-success text-success-foreground",
    pending: "bg-warning text-warning-foreground",
    rejected: "bg-destructive text-destructive-foreground",
    cancelled: "bg-muted text-muted-foreground",
    completed: "bg-secondary text-secondary-foreground",
  };
  return <Badge className={`capitalize ${map[status] ?? ""}`}>{status}</Badge>;
}
