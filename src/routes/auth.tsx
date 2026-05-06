import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CalendarCheck2 } from "lucide-react";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) navigate({ to: "/dashboard" }); }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message); else { toast.success("Welcome back!"); navigate({ to: "/dashboard" }); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
    });
    setLoading(false);
    if (error) toast.error(error.message); else toast.success("Check your email to verify your account.");
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error("Google sign-in failed");
    else if (!result.redirected) navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-gradient-subtle grid place-items-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-6 font-semibold text-lg">
          <span className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-elegant">
            <CalendarCheck2 className="h-5 w-5 text-primary-foreground" />
          </span>
          AssetFlow
        </div>
        <Card className="shadow-elegant border-0">
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in or create an account to start booking assets.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid grid-cols-2 w-full"><TabsTrigger value="login">Sign in</TabsTrigger><TabsTrigger value="signup">Sign up</TabsTrigger></TabsList>
              <TabsContent value="login" className="space-y-4 pt-4">
                <form onSubmit={handleLogin} className="space-y-3">
                  <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <div><Label>Password</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                  <Button type="submit" className="w-full bg-gradient-primary" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</Button>
                </form>
              </TabsContent>
              <TabsContent value="signup" className="space-y-4 pt-4">
                <form onSubmit={handleSignup} className="space-y-3">
                  <div><Label>Full name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                  <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <div><Label>Password</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                  <Button type="submit" className="w-full bg-gradient-primary" disabled={loading}>{loading ? "Creating..." : "Create account"}</Button>
                </form>
              </TabsContent>
            </Tabs>
            <div className="relative my-5"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div></div>
            <Button variant="outline" className="w-full" onClick={handleGoogle}>Continue with Google</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
