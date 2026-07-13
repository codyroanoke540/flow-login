import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: "var(--gradient-mesh)" }} />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg text-white" style={{ backgroundImage: "var(--gradient-brand)" }}>
            <CalendarClock className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-semibold">Cadence</span>
        </div>
        <Link to="/auth">
          <Button variant="ghost" size="sm">Sign in</Button>
        </Link>
      </header>

      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-24 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" /> AI Scheduling for medium-sized businesses
        </div>
        <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Scheduling that thinks<br />before you do.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Cadence coordinates meetings, shifts, and resources across your team — so your organisation runs on autopilot.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/auth">
            <Button className="h-11 px-6 text-white shadow-[var(--shadow-elegant)]" style={{ backgroundImage: "var(--gradient-brand)" }}>
              Get started <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/auth">
            <Button variant="outline" className="h-11 px-6">Sign in</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
