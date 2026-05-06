import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "./dashboard";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: () => <RequireAuth admin><AdminPage /></RequireAuth>,
});

function AdminPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [waiting, setWaiting] = useState<any[]>([]);

  const load = async () => {
    const [b, a, w] = await Promise.all([
      supabase.from("bookings").select("*, assets(name), profiles(full_name, email)").order("created_at", { ascending: false }),
      supabase.from("assets").select("*").order("name"),
      supabase.from("waiting_list").select("*, assets(name), profiles(full_name)").order("created_at"),
    ]);
    setBookings(b.data ?? []); setAssets(a.data ?? []); setWaiting(w.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: "approved" | "rejected" | "cancelled" | "completed" | "pending") => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(`Booking ${status}`); load(); }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Admin Console</h1>
        <p className="text-muted-foreground mt-1">Manage assets, bookings and waiting lists.</p>

        <Tabs defaultValue="bookings" className="mt-8">
          <TabsList>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="waiting">Waiting list</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="space-y-2 mt-4">
            {bookings.map((b) => (
              <Card key={b.id} className="p-4 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold">{b.assets?.name}</div>
                  <div className="text-sm text-muted-foreground">{b.profiles?.full_name ?? b.profiles?.email}</div>
                  <div className="text-xs text-muted-foreground">{format(new Date(b.start_time), "PPp")} → {format(new Date(b.end_time), "p")}</div>
                </div>
                <StatusBadge status={b.status} />
                {b.status === "pending" && <>
                  <Button size="sm" onClick={() => setStatus(b.id, "approved")}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus(b.id, "rejected")}>Reject</Button>
                </>}
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="assets" className="mt-4">
            <div className="flex justify-end mb-4"><AssetDialog onCreated={load} /></div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {assets.map((a) => (
                <Card key={a.id} className="overflow-hidden">
                  {a.image_url && <img src={a.image_url} className="aspect-video w-full object-cover" />}
                  <div className="p-4">
                    <div className="font-semibold">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.category} • {a.location}</div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="waiting" className="space-y-2 mt-4">
            {waiting.length === 0 && <Card className="p-6 text-center text-muted-foreground">Nobody is waiting.</Card>}
            {waiting.map((w) => (
              <Card key={w.id} className="p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-semibold">{w.assets?.name}</div>
                  <div className="text-sm text-muted-foreground">{w.profiles?.full_name}</div>
                  <div className="text-xs text-muted-foreground">Wants {format(new Date(w.desired_start), "PPp")} → {format(new Date(w.desired_end), "p")}</div>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function AssetDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", category: "general", location: "", image_url: "" });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("assets").insert(form);
    if (error) toast.error(error.message);
    else { toast.success("Asset created"); setOpen(false); onCreated(); setForm({ name: "", description: "", category: "general", location: "", image_url: "" }); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="bg-gradient-primary"><Plus className="h-4 w-4 mr-1" /> New asset</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add asset</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
          <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          <div><Label>Image URL</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></div>
          <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <Button type="submit" className="w-full bg-gradient-primary">Create</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
