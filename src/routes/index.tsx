import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Sparkles, Brain, CalendarDays, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cadence — The AI Operating System for Service Businesses" },
      { name: "description", content: "Cadence is an AI operations platform that runs scheduling, staffing, dispatch, and optimization for service businesses." },
      { property: "og:title", content: "Cadence — The AI Operating System for Service Businesses" },
      { property: "og:description", content: "Cadence is an AI operations platform that runs scheduling, staffing, dispatch, and optimization for service businesses." },
    ],
  }),
  component: Index,
});

const capabilities = [
  { icon: Brain, title: "AI Operations", body: "A proactive layer that surfaces conflicts, overtime, and opportunities before you notice them." },
  { icon: CalendarDays, title: "Intelligent Scheduling", body: "An optimization engine that plans days across employees, customers, routes, and constraints." },
  { icon: Users, title: "Workforce Orchestration", body: "Coordinate dispatch, coverage, skills, and utilization from a single operating picture." },
];

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

      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-16 pt-24 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" /> AI Operations Platform
        </div>
        <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          The AI Operating System<br />for service businesses.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Your workforce already knows how to work. Cadence makes your operation know how to run — scheduling, staffing, dispatch, and optimization, orchestrated by AI.
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

      <section className="relative z-10 mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-3">
        {capabilities.map((c) => (
          <div key={c.title} className="rounded-2xl border bg-card/70 p-6 backdrop-blur">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary">
              <c.icon className="h-4 w-4 text-primary" />
            </div>
            <h3 className="mt-4 font-display text-base font-semibold">{c.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
