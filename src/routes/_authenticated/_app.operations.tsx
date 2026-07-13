import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Info, Radar, Sparkles, X, ArrowRight, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Area, AreaChart, Line, LineChart, ResponsiveContainer } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  recommendations,
  healthScores,
  aiSavingsSeries,
  revenueSeries,
  overtimeSeries,
  travelSeries,
  completionSeries,
  laborCostSeries,
  type Recommendation,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/_app/operations")({
  head: () => ({ meta: [{ title: "Operations Center — Cadence" }] }),
  component: OperationsCenter,
});

function OperationsCenter() {
  const [items, setItems] = useState(recommendations);
  const [active, setActive] = useState<Recommendation | null>(null);
  const [filter, setFilter] = useState<string>("All");

  const categories = ["All", ...Array.from(new Set(recommendations.map((r) => r.category)))];
  const visible = filter === "All" ? items : items.filter((r) => r.category === filter);

  function approve(id: string) {
    setItems((xs) => xs.filter((x) => x.id !== id));
    toast.success("Recommendation approved");
  }
  function dismiss(id: string) {
    setItems((xs) => xs.filter((x) => x.id !== id));
    toast("Dismissed");
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-6 py-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Radar className="h-3.5 w-3.5" /> Operations Center
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Command your operation</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            A single surface for what your AI operations layer has surfaced, resolved, and predicted — across scheduling, staffing, and revenue.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">{items.length} open</span>
          <span>·</span>
          <span>Live</span>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        </div>
      </header>

      {/* Operational Health */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Operational health</h2>
            <p className="text-sm text-muted-foreground">Composite scores across the operation.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {healthScores.map((h) => (
            <Card key={h.label} className="border-border/60">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{h.label}</p>
                    <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{h.score}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{h.delta}</Badge>
                </div>
                <Progress value={h.score} className="mt-4 h-1.5" />
                <p className="mt-3 text-xs text-muted-foreground">{h.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* AI Operations Feed */}
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">AI operations feed</h2>
            <p className="text-sm text-muted-foreground">Prioritized actions. Approve to execute, dismiss to ignore, or ask for reasoning.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={
                  "rounded-full border px-3 py-1 text-xs transition " +
                  (filter === c
                    ? "border-foreground/20 bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:text-foreground")
                }
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary">
                <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-display text-lg font-semibold">You're all caught up</h3>
              <p className="text-sm text-muted-foreground">Cadence will surface new recommendations as your operation changes.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {visible.map((r) => (
              <Card key={r.id} className="border-border/60 transition hover:shadow-[var(--shadow-elegant)]">
                <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{r.category}</Badge>
                      <span className="text-xs text-muted-foreground">{r.confidence}% confidence</span>
                      {r.savings && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          <TrendingUp className="h-3 w-3" /> {r.savings}
                        </span>
                      )}
                    </div>
                    <CardTitle className="mt-2 font-display text-base font-semibold leading-snug">{r.title}</CardTitle>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setActive(r)}>
                      <Info className="mr-1.5 h-3.5 w-3.5" /> Explain
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => dismiss(r.id)}>
                      <X className="mr-1.5 h-3.5 w-3.5" /> Dismiss
                    </Button>
                    <Button
                      size="sm"
                      className="text-white"
                      style={{ backgroundImage: "var(--gradient-brand)" }}
                      onClick={() => approve(r.id)}
                    >
                      <Check className="mr-1.5 h-3.5 w-3.5" /> Approve
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Problem</p>
                    <p className="mt-1 text-foreground">{r.problem}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Why it matters</p>
                    <p className="mt-1 text-foreground">{r.whyItMatters ?? r.reason}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Business impact</p>
                    <p className="mt-1 text-foreground">{r.impact}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Recommended action</p>
                    <p className="mt-1 text-foreground">{r.action}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Analytics preview */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Analytics preview</h2>
            <p className="text-sm text-muted-foreground">The trends behind the recommendations.</p>
          </div>
          <Link to="/analytics" className="text-sm text-muted-foreground hover:text-foreground">
            Open analytics <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MiniWidget title="Revenue" value="$102.4k" delta="+4.7% WoW" data={revenueSeries.map((d) => ({ v: d.revenue }))} kind="area" />
          <MiniWidget title="Labor cost (actual)" value="$70.4k" delta="-$2.6k vs plan" data={laborCostSeries.map((d) => ({ v: d.actual }))} kind="line" />
          <MiniWidget title="Appointment completion" value="97%" delta="+1 pt" data={completionSeries.map((d) => ({ v: d.completed }))} kind="area" />
          <MiniWidget title="Travel miles" value="3,440" delta="-18% vs W1" data={travelSeries.map((d) => ({ v: d.miles }))} kind="line" />
          <MiniWidget title="Overtime hours" value="22" delta="-26 vs W1" data={overtimeSeries.map((d) => ({ v: d.hours }))} kind="line" />
          <MiniWidget title="AI savings" value="$3,410" delta="+$210 WoW" data={aiSavingsSeries.map((d) => ({ v: d.savings }))} kind="area" />
        </div>
      </section>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Why Cadence recommended this
            </SheetTitle>
            <SheetDescription>Transparency into the signals behind the recommendation.</SheetDescription>
          </SheetHeader>
          {active && (
            <div className="mt-6 space-y-5 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Recommendation</p>
                <p className="mt-1 font-medium">{active.title}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Signals</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>Historical pattern match ({active.confidence}%)</li>
                  <li>Live schedule + workforce state</li>
                  <li>Impact model projection: {active.impact}</li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reasoning</p>
                <p className="mt-1 text-muted-foreground">{active.reason}</p>
              </div>
              {active.whyItMatters && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Why it matters</p>
                  <p className="mt-1 text-muted-foreground">{active.whyItMatters}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MiniWidget({
  title,
  value,
  delta,
  data,
  kind,
}: {
  title: string;
  value: string;
  delta: string;
  data: { v: number }[];
  kind: "area" | "line";
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">{delta}</p>
          </div>
        </div>
        <div className="mt-3 h-14">
          <ResponsiveContainer width="100%" height="100%">
            {kind === "area" ? (
              <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`g-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke="var(--color-primary)" fill={`url(#g-${title})`} strokeWidth={2} />
              </AreaChart>
            ) : (
              <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <Line type="monotone" dataKey="v" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}