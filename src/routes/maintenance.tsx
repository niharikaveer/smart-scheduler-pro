import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Wrench, Activity, History } from "lucide-react";

export const Route = createFileRoute("/maintenance")({
  component: () => <RequireAuth><MaintenancePage /></RequireAuth>,
});

const STATUS_COLORS: Record<string, string> = {
  available: "bg-success text-success-foreground",
  rented: "bg-primary text-primary-foreground",
  under_maintenance: "bg-warning text-warning-foreground",
  retired: "bg-muted text-muted-foreground",
};

function MaintenancePage() {
  const { role } = useAuth();
  const canEdit = role === "admin" || role === "staff";
  const [assets, setAssets] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  const load = async () => {
    const [a, l] = await Promise.all([
      supabase.from("assets").select("*").order("name"),
      supabase.from("maintenance_logs").select("*, assets(name)").order("performed_at", { ascending: false }).limit(50),
    ]);
    setAssets(a.data ?? []);
    setLogs(l.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("assets").update({ status: status as any }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Status updated"); load(); }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center"><Wrench className="h-5 w-5 text-primary-foreground" /></div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Maintenance & Lifecycle</h1>
            <p className="text-muted-foreground">Track asset health, schedule service, log repairs.</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold mt-10 mb-3 flex items-center gap-2"><Activity className="h-4 w-4" /> Asset lifecycle</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((a) => {
            const threshold = a.maintenance_after_bookings ?? 0;
            const pct = threshold > 0 ? Math.min(100, (a.usage_count / threshold) * 100) : 0;
            return (
              <Card key={a.id} className="p-5 border shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.category}</div>
                  </div>
                  <Badge className={`capitalize ${STATUS_COLORS[a.status] ?? ""}`}>{String(a.status).replace("_", " ")}</Badge>
                </div>
                <div className="mt-4 text-xs text-muted-foreground">Usage: <b className="text-foreground">{a.usage_count}</b>{threshold > 0 && <> / {threshold} bookings</>}</div>
                {threshold > 0 && (
                  <div className="h-1.5 mt-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-2">
                  Last serviced: {a.last_maintenance_at ? format(new Date(a.last_maintenance_at), "PP") : "—"}
                </div>
                {canEdit && (
                  <div className="flex gap-2 mt-4 flex-wrap">
                    <Select value={a.status} onValueChange={(v) => setStatus(a.id, v)}>
                      <SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="rented">Rented</SelectItem>
                        <SelectItem value="under_maintenance">Under maintenance</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                      </SelectContent>
                    </Select>
                    <LogDialog asset={a} onSaved={load} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <h2 className="text-lg font-semibold mt-12 mb-3 flex items-center gap-2"><History className="h-4 w-4" /> Maintenance history</h2>
        {logs.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No maintenance recorded yet.</Card>
        ) : (
          <div className="space-y-2">
            {logs.map((l) => (
              <Card key={l.id} className="p-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-medium">{l.assets?.name}</div>
                  <div className="text-xs text-muted-foreground">{format(new Date(l.performed_at), "PPp")} • {l.log_type}</div>
                  {l.notes && <div className="text-sm mt-1">{l.notes}</div>}
                </div>
                {l.next_due_at && <Badge variant="outline">Next: {format(new Date(l.next_due_at), "PP")}</Badge>}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function LogDialog({ asset, onSaved }: { asset: any; onSaved: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [logType, setLogType] = useState("manual");
  const [nextDue, setNextDue] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("maintenance_logs").insert({
      asset_id: asset.id, performed_by: user!.id,
      log_type: logType, notes,
      next_due_at: nextDue ? new Date(nextDue).toISOString() : null,
    });
    if (error) return toast.error(error.message);
    toast.success("Maintenance logged");
    setOpen(false); setNotes(""); setNextDue("");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Wrench className="h-3.5 w-3.5 mr-1" /> Log</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Log maintenance — {asset.name}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Type</Label>
            <Select value={logType} onValueChange={setLogType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual service</SelectItem>
                <SelectItem value="preventive">Preventive</SelectItem>
                <SelectItem value="repair">Repair</SelectItem>
                <SelectItem value="inspection">Inspection</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Notes</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div><Label>Next due (optional)</Label><Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} /></div>
          <Button type="submit" className="w-full bg-gradient-primary">Save log</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
