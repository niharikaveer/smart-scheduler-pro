import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { CalendarCheck2, ShieldCheck, Layers, Clock, Users, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main>
        <section className="max-w-7xl mx-auto px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium mb-6">
            <Sparkles className="h-3.5 w-3.5" /> Advanced Booking & Scheduling
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight max-w-3xl mx-auto leading-[1.1]">
            Rent assets without the chaos.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            AssetFlow brings smart scheduling, conflict detection, priority queues and waiting lists to every room, device and resource at your office or school.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Button size="lg" asChild className="bg-gradient-primary shadow-elegant">
              <Link to="/auth">Start booking</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/assets">Browse assets</Link>
            </Button>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-6">
          {[
            { icon: Clock, title: "Time-slot booking", desc: "Reserve any asset by start & end time with instant availability." },
            { icon: ShieldCheck, title: "Conflict detection", desc: "Double-bookings are blocked at the database level. No collisions." },
            { icon: Users, title: "Priority queues", desc: "Admins > Staff > Students. Higher priority gets the slot." },
            { icon: CalendarCheck2, title: "Auto approval", desc: "Smart rules approve trusted users instantly, queue the rest." },
            { icon: Layers, title: "Waiting list", desc: "Busy asset? Join the queue and get notified when it frees up." },
            { icon: Sparkles, title: "Next slot suggestions", desc: "Can't get your time? We suggest the closest available window." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl bg-card p-6 shadow-card border">
              <div className="h-11 w-11 rounded-xl bg-gradient-primary grid place-items-center shadow-elegant mb-4">
                <f.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-lg">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1.5">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
