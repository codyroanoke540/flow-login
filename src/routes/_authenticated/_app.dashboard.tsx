import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Sparkles, TrendingDown, TrendingUp, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { briefing, kpis, recommendations } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Cadence" }] }),
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function firstNameFromEmail(email?: string | null) {
  if (!email) return "there";
  const local = email.split("@")[0];
  const first = local.split(/[._-]/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function Dashboard() {
  const { user } = Route.useRouteContext();
  const name = firstNameFromEmail(user?.email);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8">
      {/* AI Briefing */}
      <section className="relative overflow-hidden rounded-2xl border bg-card p-8 shadow-sm">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: "var(--gradient-mesh)" }} />
        <div className="relative">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> Overnight AI briefing
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {greeting()}, {name}.
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            I analyzed your business overnight. Here's what needs your attention today, and what I can handle for you.
          </p>

          <ul className="mt-6 grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {briefing.map((b) => (
              <li key={b.label} className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 text-sm">
                <span className="text-muted-foreground">{b.label}</span>
                <span className={
                  "font-medium tabular-nums " +
                  (b.tone === "warn" ? "text-amber-600 dark:text-amber-400" : b.tone === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")
                }>
                  {b.value}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/ai">
              <Button className="h-11 px-5 text-white shadow-[var(--shadow-elegant)]" style={{ backgroundImage: "var(--gradient-brand)" }}>
                Review AI Recommendations <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/operations">
              <Button variant="outline" className="h-11 px-5">
                Open Operations Center
              </Button>
            </Link>
            <Link to="/schedule">
              <Button variant="outline" className="h-11 px-5">
                <CalendarDays className="mr-2 h-4 w-4" /> Open Schedule
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight">Today's operating signal</h2>
          <span className="text-xs text-muted-foreground">Updated just now</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <Card key={k.label} className="border-border/60">
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{k.label}</p>
                <p className="mt-2 font-display text-2xl font-semibold tracking-tight tabular-nums">{k.value}</p>
                <div className="mt-2 flex items-center gap-1.5 text-xs">
                  {k.trend === "up" && <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                  {k.trend === "down" && <TrendingDown className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                  {k.trend === "flat" && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className="text-muted-foreground">{k.delta}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Top recommendations */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight">Top AI recommendations</h2>
          <Link to="/ai" className="text-sm text-muted-foreground hover:text-foreground">
            View all <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {recommendations.slice(0, 3).map((r) => (
            <Card key={r.id} className="border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{r.category}</Badge>
                  <span className="text-xs text-muted-foreground">{r.confidence}% confidence</span>
                </div>
                <CardTitle className="mt-2 font-display text-base font-semibold leading-snug">{r.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>{r.action}</p>
                <p className="mt-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">{r.impact}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}