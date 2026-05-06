import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { toast } from "sonner";
import { suggestNextSlot, fmtSlot } from "@/lib/booking";
import { addHours, format } from "date-fns";
import { AlertCircle, CalendarClock, CheckCircle2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  createDemoBooking,
  getDemoAssetById,
  getDemoUpcomingForAsset,
  isDemoAssetId,
} from "@/lib/demoData";

export const Route = createFileRoute("/book/$assetId")({
  component: () => <RequireAuth><BookPage /></RequireAuth>,
});

function toLocalInput(d: Date) {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 16);
}

function BookPage() {
  const { assetId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [asset, setAsset] = useState<any>(null);
  const [start, setStart] = useState(toLocalInput(addHours(new Date(), 1)));
  const [end, setEnd] = useState(toLocalInput(addHours(new Date(), 2)));
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<Date | null>(null);
  const [conflict, setConflict] = useState(false);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    supabase
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .single()
      .then(({ data }) => {
        if (!data && isDemoAssetId(assetId)) {
          setAsset(getDemoAssetById(assetId));
          setDemoMode(true);
          return;
        }
        setAsset(data);
        setDemoMode(false);
      });
    refreshUpcoming();
  }, [assetId]);

  const refreshUpcoming = async () => {
    if (isDemoAssetId(assetId)) {
      setUpcoming(getDemoUpcomingForAsset(assetId));
      return;
    }
    const { data } = await supabase
      .from("bookings")
      .select("start_time,end_time,status")
      .eq("asset_id", assetId)
      .in("status", ["approved", "pending"])
      .gte("end_time", new Date().toISOString())
      .order("start_time")
      .limit(10);
    setUpcoming(data ?? []);
  };

  const checkConflict = async () => {
    const s = new Date(start), e = new Date(end);
    if (e <= s) {
      setConflict(true);
      setSuggestion(null);
      return;
    }
    if (asset?.status === "under_maintenance" || asset?.status === "retired") {
      setConflict(true);
      setSuggestion(null);
      return;
    }
    if (isDemoAssetId(assetId)) {
      const demoUpcoming = getDemoUpcomingForAsset(assetId);
      const has = demoUpcoming.some(
        (b) =>
          ["approved", "pending"].includes(b.status) &&
          new Date(b.start_time) < e &&
          new Date(b.end_time) > s,
      );
      setConflict(has);
      setSuggestion(null);
      return;
    }
    const { data } = await supabase
      .from("bookings").select("id")
      .eq("asset_id", assetId).in("status", ["approved", "pending"])
      .lt("start_time", e.toISOString()).gt("end_time", s.toISOString()).limit(1);
    const has = (data ?? []).length > 0;
    setConflict(has);
    if (has) {
      const dur = (e.getTime() - s.getTime()) / 60000;
      const next = await suggestNextSlot(assetId, s, dur);
      setSuggestion(next);
    } else setSuggestion(null);
  };

  useEffect(() => { checkConflict(); /* eslint-disable-next-line */ }, [start, end, asset?.status]);

  const applySuggestion = () => {
    if (!suggestion) return;
    const dur = new Date(end).getTime() - new Date(start).getTime();
    setStart(toLocalInput(suggestion));
    setEnd(toLocalInput(new Date(suggestion.getTime() + dur)));
  };

  const submit = async (asWaitingList = false) => {
    setLoading(true);
    const s = new Date(start), e = new Date(end);
    if (e <= s) {
      setLoading(false);
      toast.error("End time must be after start time.");
      return;
    }
    if (asset?.status === "under_maintenance" || asset?.status === "retired") {
      setLoading(false);
      toast.error(`Asset is ${String(asset.status).replace("_", " ")} and cannot be booked.`);
      return;
    }
    if (isDemoAssetId(assetId)) {
      try {
        createDemoBooking({
          assetId,
          userId: user!.id,
          start: s.toISOString(),
          end: e.toISOString(),
          purpose,
        });
      } catch (err: any) {
        setLoading(false);
        toast.error(err?.message ?? "Could not create booking.");
        return;
      }
      setLoading(false);
      toast.success("Booking submitted, awaiting approval.");
      navigate({ to: "/bookings" });
      return;
    }
    if (asWaitingList) {
      const { error } = await supabase.from("waiting_list").insert({
        asset_id: assetId, user_id: user!.id, desired_start: s.toISOString(), desired_end: e.toISOString(),
      });
      setLoading(false);
      if (error) toast.error(error.message);
      else { toast.success("Added to waiting list. We'll notify you."); navigate({ to: "/bookings" }); }
      return;
    }
    const { data, error } = await supabase.from("bookings").insert({
      asset_id: assetId, user_id: user!.id,
      start_time: s.toISOString(), end_time: e.toISOString(), purpose,
    }).select().single();
    setLoading(false);
    if (error) toast.error(error.message);
    else if (data?.status === "rejected") toast.error("This asset is already booked for that time slot.");
    else if (data?.status === "approved") { toast.success("Booking approved!"); navigate({ to: "/bookings" }); }
    else { toast.success("Booking submitted, awaiting approval."); navigate({ to: "/bookings" }); }
  };

  if (!asset) return <div className="min-h-screen grid place-items-center">Loading…</div>;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-6 py-10 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="overflow-hidden border shadow-card">
            <div className="aspect-[3/1] bg-muted">
              {asset.image_url && <img src={asset.image_url} alt={asset.name} className="w-full h-full object-cover" />}
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-2xl font-bold">{asset.name}</h1>
                <Badge variant="secondary">{asset.category}</Badge>
              </div>
              {asset.description && <p className="text-muted-foreground mt-2">{asset.description}</p>}
            </div>
          </Card>

          <Card className="p-6 border shadow-card">
            <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarClock className="h-5 w-5" /> Reserve a slot</h2>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div><Label>Start time</Label><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></div>
              <div><Label>End time</Label><Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
            </div>
            <div className="mt-4"><Label>Purpose (optional)</Label><Textarea rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="What do you need this for?" /></div>

            {conflict ? (
              <div className="mt-5 rounded-lg border bg-destructive/5 border-destructive/30 p-4">
                <div className="flex items-start gap-2"><AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-destructive">Slot conflict detected</div>
                    <p className="text-sm text-muted-foreground mt-1">This asset is already booked during your selected window.</p>
                    {suggestion && (
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm">Next available: <b>{fmtSlot(suggestion)}</b></span>
                        <Button size="sm" variant="outline" onClick={applySuggestion}>Use this slot</Button>
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => submit(true)} disabled={loading}>Join waiting list</Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-lg border bg-success/5 border-success/30 p-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span className="text-sm">Slot is available.</span>
              </div>
            )}

            <Button className="mt-5 w-full bg-gradient-primary" disabled={loading || conflict} onClick={() => submit(false)}>
              {loading ? "Booking…" : "Confirm booking"}
            </Button>
          </Card>
        </div>

        <Card className="p-6 border shadow-card h-fit">
          <h3 className="font-semibold mb-3">Upcoming reservations</h3>
          {demoMode && <p className="text-xs text-muted-foreground mb-3">Demo data mode</p>}
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming bookings.</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((u, i) => (
                <li key={i} className="text-sm border-l-2 border-primary pl-3">
                  <div className="font-medium">{format(new Date(u.start_time), "MMM d, h:mm a")}</div>
                  <div className="text-muted-foreground text-xs">until {format(new Date(u.end_time), "h:mm a")} • {u.status}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
