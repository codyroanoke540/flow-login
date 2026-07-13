import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Info, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { recommendations, type Recommendation } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/_app/ai")({
  head: () => ({ meta: [{ title: "AI Command Center — Cadence" }] }),
  component: AiCenter,
});

function AiCenter() {
  const [items, setItems] = useState(recommendations);
  const [active, setActive] = useState<Recommendation | null>(null);

  function approve(id: string) {
    setItems((xs) => xs.filter((x) => x.id !== id));
    toast.success("Recommendation approved");
  }
  function dismiss(id: string) {
    setItems((xs) => xs.filter((x) => x.id !== id));
    toast("Dismissed");
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> AI Command Center
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Recommendations</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Prioritized actions your AI operations layer surfaced. Approve to execute, dismiss to ignore, or ask for reasoning.
          </p>
        </div>
        <div className="hidden text-right text-sm text-muted-foreground md:block">
          <div className="tabular-nums">{items.length} open</div>
          <div className="text-xs">Refreshed 2 min ago</div>
        </div>
      </header>

      {items.length === 0 ? (
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
          {items.map((r) => (
            <Card key={r.id} className="border-border/60">
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{r.category}</Badge>
                    <span className="text-xs text-muted-foreground">{r.confidence}% confidence</span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">· {r.impact}</span>
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
                  <Button size="sm" className="text-white" style={{ backgroundImage: "var(--gradient-brand)" }} onClick={() => approve(r.id)}>
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Approve
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Problem</p>
                  <p className="mt-1 text-foreground">{r.problem}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reason</p>
                  <p className="mt-1 text-foreground">{r.reason}</p>
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

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Why Cadence recommended this</SheetTitle>
            <SheetDescription>Transparency into the signals behind the recommendation.</SheetDescription>
          </SheetHeader>
          {active && (
            <div className="mt-6 space-y-4 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Recommendation</p>
                <p className="mt-1 font-medium">{active.title}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Signals</p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  <li>Historical pattern match ({active.confidence}%)</li>
                  <li>Live schedule + workforce state</li>
                  <li>Impact model projection: {active.impact}</li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reasoning</p>
                <p className="mt-1 text-muted-foreground">{active.reason}</p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}