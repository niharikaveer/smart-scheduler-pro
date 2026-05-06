import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Search } from "lucide-react";

export const Route = createFileRoute("/assets")({
  component: () => <RequireAuth><AssetsPage /></RequireAuth>,
});

function AssetsPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("assets").select("*").eq("is_active", true).order("name").then(({ data }) => setAssets(data ?? []));
  }, []);

  const filtered = assets.filter((a) =>
    [a.name, a.category, a.location].join(" ").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Assets</h1>
            <p className="text-muted-foreground mt-1">Browse available resources and book a slot.</p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search assets..." className="pl-9" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
          {filtered.map((a) => (
            <Card key={a.id} className="overflow-hidden shadow-card border group hover:shadow-elegant transition-shadow">
              <div className="aspect-video bg-muted overflow-hidden">
                {a.image_url && <img src={a.image_url} alt={a.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-lg leading-tight">{a.name}</h3>
                  <Badge variant="secondary">{a.category}</Badge>
                </div>
                {a.location && <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5"><MapPin className="h-3.5 w-3.5" />{a.location}</div>}
                {a.description && <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{a.description}</p>}
                <Button asChild className="w-full mt-4 bg-gradient-primary">
                  <Link to="/book/$assetId" params={{ assetId: a.id }}>Book this asset</Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
        {filtered.length === 0 && <Card className="p-10 text-center text-muted-foreground mt-6">No assets found.</Card>}
      </main>
    </div>
  );
}
