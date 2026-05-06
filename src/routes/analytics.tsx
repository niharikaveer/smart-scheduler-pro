import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { format, subDays, startOfDay } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, CartesianGrid, Legend } from "recharts";
import { TrendingUp, Package, AlertTriangle, Wrench } from "lucide-react";
import { getAllDemoBookings, getDemoLifecycleAssets, getDemoMaintenanceLogs } from "@/lib/demoData";

export const Route = createFileRoute("/analytics")({
  component: () => <RequireAuth><AnalyticsPage /></RequireAuth>,
});

const COLORS = ["hsl(var(--primary))", "hsl(var(--success, 142 71% 45%))", "hsl(var(--warning, 38 92% 50%))", "hsl(var(--muted-foreground))"];

function AnalyticsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [maint, setMaint] = useState<any[]>([]);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    (async () => {
      const since = subDays(new Date(), 30).toISOString();
      const [b, a, m] = await Promise.all([
        supabase.from("bookings").select("*, assets(name)").gte("created_at", since),
        supabase.from("assets").select("*"),
        supabase.from("maintenance_logs").select("performed_at, asset_id").gte("performed_at", since),
      ]);
      if (!a.data || a.data.length === 0) {
        const demoAssets = getDemoLifecycleAssets();
        const demoBookings = getAllDemoBookings()
          .map((booking) => {
            const asset = demoAssets.find((d) => d.id === booking.asset_id);
            return { ...booking, assets: { name: asset?.name ?? "Unknown" } };
          })
          .filter((x) => x.created_at >= since);
        const demoMaint = getDemoMaintenanceLogs()
          .map((x) => ({ performed_at: x.performed_at, asset_id: x.asset_id }))
          .filter((x) => x.performed_at >= since);
        setBookings(demoBookings);
        setAssets(demoAssets);
        setMaint(demoMaint);
        setDemoMode(true);
        return;
      }
      setBookings(b.data ?? []);
      setAssets(a.data ?? []);
      setMaint(m.data ?? []);
      setDemoMode(false);
    })();
  }, []);

  const usageByAsset = useMemo(() => {
    const map: Record<string, number> = {};
    bookings.forEach((b) => { const n = b.assets?.name ?? "Unknown"; map[n] = (map[n] ?? 0) + 1; });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [bookings]);

  const trend = useMemo(() => {
    const days: { day: string; bookings: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i));
      const label = format(d, "MMM d");
      const count = bookings.filter((b) => startOfDay(new Date(b.created_at)).getTime() === d.getTime()).length;
      days.push({ day: label, bookings: count });
    }
    return days;
  }, [bookings]);

  const statusBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    assets.forEach((a) => { map[a.status] = (map[a.status] ?? 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name: name.replace("_", " "), value }));
  }, [assets]);

  const availableRate = assets.length
    ? Math.round((assets.filter((a) => a.status === "available").length / assets.length) * 100)
    : 0;

  const least = [...usageByAsset].slice(-5).reverse();
  const top = usageByAsset.slice(0, 5);

  const cards = [
    { icon: Package, label: "Total assets", value: assets.length },
    { icon: TrendingUp, label: "Bookings (30d)", value: bookings.length },
    { icon: Wrench, label: "Maintenance (30d)", value: maint.length },
    { icon: AlertTriangle, label: "Availability rate", value: `${availableRate}%` },
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Analytics & Insights</h1>
        <p className="text-muted-foreground mt-1">Usage trends, hot/cold assets, lifecycle and maintenance metrics.</p>
        {demoMode && <p className="text-xs text-muted-foreground mt-2">Demo mode: analytics are generated from your local bookings and lifecycle data.</p>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          {cards.map((c) => (
            <Card key={c.label} className="p-5 border shadow-card">
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

        <div className="grid lg:grid-cols-2 gap-6 mt-8">
          <Card className="p-5 border shadow-card">
            <h3 className="font-semibold mb-4">Booking trend (last 14 days)</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="day" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="bookings" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5 border shadow-card">
            <h3 className="font-semibold mb-4">Asset status breakdown</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={statusBreakdown} dataKey="value" nameKey="name" outerRadius={90} label>
                    {statusBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5 border shadow-card">
            <h3 className="font-semibold mb-4">Most used assets</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={top}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5 border shadow-card">
            <h3 className="font-semibold mb-2">Underutilized assets</h3>
            <p className="text-xs text-muted-foreground mb-3">Lowest booking counts — candidates for reallocation or retirement.</p>
            {least.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">No data yet.</div>
            ) : (
              <ul className="divide-y">
                {least.map((u) => (
                  <li key={u.name} className="py-2.5 flex items-center justify-between">
                    <span className="text-sm">{u.name}</span>
                    <span className="text-sm font-semibold text-muted-foreground">{u.count} booking{u.count === 1 ? "" : "s"}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
