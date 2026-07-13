import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarClock, LogOut } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Cadence" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md text-white" style={{ backgroundImage: "var(--gradient-brand)" }}>
              <CalendarClock className="h-4 w-4" />
            </div>
            <span className="font-display text-base font-semibold">Cadence</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{user.email}</h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          Your workspace is ready. This is where your AI scheduling dashboard will live.
        </p>
      </section>
    </main>
  );
}