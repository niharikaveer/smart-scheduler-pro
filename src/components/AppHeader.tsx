import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarCheck2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

export function AppHeader() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b bg-card/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
          <span className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-elegant">
            <CalendarCheck2 className="h-5 w-5 text-primary-foreground" />
          </span>
          <span>AssetFlow</span>
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Link to="/dashboard" className="text-sm font-medium px-3 py-2 rounded-md hover:bg-accent">Dashboard</Link>
              <Link to="/assets" className="text-sm font-medium px-3 py-2 rounded-md hover:bg-accent">Assets</Link>
              <Link to="/bookings" className="text-sm font-medium px-3 py-2 rounded-md hover:bg-accent">My Bookings</Link>
              {role === "admin" && (
                <Link to="/admin" className="text-sm font-medium px-3 py-2 rounded-md hover:bg-accent">Admin</Link>
              )}
              {role && <Badge variant="secondary" className="ml-2 capitalize">{role}</Badge>}
              <Button variant="ghost" size="icon" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth" className="text-sm font-medium px-3 py-2 rounded-md hover:bg-accent">Sign in</Link>
              <Button asChild><Link to="/auth">Get started</Link></Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
