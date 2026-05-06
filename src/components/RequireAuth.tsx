import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export function RequireAuth({ children, admin }: { children: React.ReactNode; admin?: boolean }) {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth" });
    else if (admin && role !== "admin") navigate({ to: "/dashboard" });
  }, [user, role, loading, admin, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }
  return <>{children}</>;
}
