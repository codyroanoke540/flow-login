import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { completionSeries, laborUtilization, revenueSeries } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/_app/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Cadence" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-muted-foreground">Executive-grade insight across your operation.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">Last 6 weeks</Button>
          <Button variant="outline" size="sm">Export</Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader><CardTitle className="font-display text-base">Labor utilization</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={laborUtilization} margin={{ top: 6, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="lu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="week" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="value" stroke="var(--color-primary)" fill="url(#lu)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader><CardTitle className="font-display text-base">Revenue</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueSeries} margin={{ top: 6, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="week" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader><CardTitle className="font-display text-base">Appointment completion</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={completionSeries} margin={{ top: 6, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="week" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Bar dataKey="completed" stackId="a" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="missed" stackId="a" fill="var(--color-muted)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader><CardTitle className="font-display text-base">Operational summary</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {[
                ["Travel efficiency", "88%", "+2.1% vs prior"],
                ["Avg AI savings / week", "$3,410", "+$420"],
                ["Utilization", "84%", "+3 pts"],
                ["Missed appointments", "3%", "-1 pt"],
                ["Overtime hours", "22", "-8 hrs"],
                ["Customer satisfaction", "4.82", "+0.06"],
              ].map(([label, value, delta]) => (
                <div key={label}>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-display text-lg font-semibold tabular-nums">{value}</dd>
                  <dd className="text-xs text-emerald-600 dark:text-emerald-400">{delta}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}