import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Plus, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { appointments } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/_app/schedule")({
  head: () => ({ meta: [{ title: "Schedule — Cadence" }] }),
  component: SchedulePage,
});

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = Array.from({ length: 11 }, (_, i) => i + 7); // 7..17

function SchedulePage() {
  const [view, setView] = useState("week");

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Schedule</h1>
          <p className="mt-1 text-muted-foreground">A single view of every appointment, resource, and route.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon"><ChevronLeft className="h-4 w-4" /></Button>
          <div className="rounded-md border bg-card px-3 py-1.5 text-sm font-medium">This week</div>
          <Button variant="outline" size="icon"><ChevronRight className="h-4 w-4" /></Button>
          <Button className="ml-2 text-white" style={{ backgroundImage: "var(--gradient-brand)" }}>
            <Plus className="mr-1.5 h-4 w-4" /> New appointment
          </Button>
        </div>
      </header>

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="day">Day</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="week" className="mt-4">
          <Card className="overflow-hidden border-border/60">
            <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b bg-secondary/40 text-xs font-medium text-muted-foreground">
              <div />
              {days.map((d, i) => (
                <div key={d} className="border-l px-3 py-2 text-center">
                  <div>{d}</div>
                  <div className="font-display text-sm text-foreground">{13 + i}</div>
                </div>
              ))}
            </div>
            <div className="relative grid grid-cols-[64px_repeat(7,1fr)]">
              <div>
                {hours.map((h) => (
                  <div key={h} className="h-16 border-b pr-2 pt-1 text-right text-[10px] text-muted-foreground">
                    {h}:00
                  </div>
                ))}
              </div>
              {days.map((_, dayIdx) => (
                <div key={dayIdx} className="relative border-l">
                  {hours.map((h) => (
                    <div key={h} className="h-16 border-b" />
                  ))}
                  {appointments
                    .filter((a) => a.day === dayIdx)
                    .map((a) => {
                      const [hh, mm] = a.time.split(":" ).map(Number);
                      const top = ((hh - 7) + mm / 60) * 64;
                      const height = a.duration * 64 - 4;
                      return (
                        <div
                          key={a.id}
                          className="absolute left-1 right-1 rounded-md border border-primary/20 bg-primary/10 p-2 text-[11px] shadow-sm hover:bg-primary/15"
                          style={{ top, height }}
                        >
                          <div className="flex items-center gap-1 font-medium text-foreground">
                            {a.aiSuggested && <Sparkles className="h-3 w-3 text-primary" />}
                            {a.customer}
                          </div>
                          <div className="text-muted-foreground">{a.employee}</div>
                          <div className="text-muted-foreground">{a.time}</div>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="day" className="mt-4">
          <Card className="border-border/60">
            <CardContent className="divide-y p-0">
              {appointments.filter((a) => a.day === 0).map((a) => (
                <div key={a.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-20 font-display text-sm tabular-nums text-muted-foreground">{a.time}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {a.aiSuggested && <Sparkles className="h-3.5 w-3.5 text-primary" />}
                      {a.customer}
                    </div>
                    <div className="text-xs text-muted-foreground">{a.employee} · {a.duration}h</div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{a.category}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card className="border-border/60">
            <CardContent className="divide-y p-0">
              {appointments.map((a) => (
                <div key={a.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                  <div className="w-16 tabular-nums text-muted-foreground">{days[a.day]} {a.time}</div>
                  <div className="flex-1 truncate font-medium">{a.customer}</div>
                  <div className="hidden text-muted-foreground sm:block">{a.employee}</div>
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{a.category}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {["month", "map", "timeline"].map((v) => (
          <TabsContent key={v} value={v} className="mt-4">
            <Card className="border-border/60 border-dashed">
              <CardContent className="flex flex-col items-center gap-2 py-24 text-center">
                <h3 className="font-display text-lg font-semibold capitalize">{v} view</h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  Coming soon. Drag-and-drop scheduling, geographic dispatch, and multi-day gantt views are on the roadmap.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}