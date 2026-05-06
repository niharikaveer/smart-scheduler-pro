import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./dashboard";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/bookings")({
  component: () => <RequireAuth><MyBookings /></RequireAuth>,
});

function MyBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("bookings").select("*, assets(name, image_url)")
      .eq("user_id", user!.id).order("start_time", { ascending: false });
    setBookings(data ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const cancel = async (id: string) => {
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Booking cancelled"); load(); }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">My Bookings</h1>
        <p className="text-muted-foreground mt-1">All your reservations in one place.</p>

        <div className="mt-8 space-y-3">
          {bookings.length === 0 && <Card className="p-10 text-center text-muted-foreground">No bookings yet.</Card>}
          {bookings.map((b) => (
            <Card key={b.id} className="p-4 flex items-center gap-4">
              {b.assets?.image_url && <img src={b.assets.image_url} className="h-16 w-20 object-cover rounded-md" />}
              <div className="flex-1">
                <div className="font-semibold">{b.assets?.name}</div>
                <div className="text-sm text-muted-foreground">{format(new Date(b.start_time), "PPp")} → {format(new Date(b.end_time), "p")}</div>
                {b.purpose && <div className="text-xs text-muted-foreground mt-1">{b.purpose}</div>}
              </div>
              <StatusBadge status={b.status} />
              {(b.status === "pending" || b.status === "approved") && (
                <Button size="sm" variant="outline" onClick={() => cancel(b.id)}>Cancel</Button>
              )}
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
