import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Plus, Workflow } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { automations as seed } from "@/lib/mock-data";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/_app/automations")({
  head: () => ({ meta: [{ title: "Automations — Cadence" }] }),
  component: AutomationsPage,
});

function AutomationsPage() {
  const [items, setItems] = useState(seed);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Automations</h1>
          <p className="mt-1 text-muted-foreground">Turn recurring decisions into policies your AI handles autonomously.</p>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button className="text-white" style={{ backgroundImage: "var(--gradient-brand)" }}>
              <Plus className="mr-1.5 h-4 w-4" /> New automation
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>New automation</SheetTitle>
              <SheetDescription>Define a trigger and the action Cadence should take.</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <div className="space-y-1.5"><Label>Name</Label><Input placeholder="Weekend overtime alert" /></div>
              <div className="space-y-1.5"><Label>When</Label><Input placeholder="Projected overtime exceeds…" /></div>
              <div className="space-y-1.5"><Label>Then</Label><Input placeholder="Notify manager on Slack" /></div>
            </div>
            <SheetFooter className="mt-6">
              <Button className="w-full text-white" style={{ backgroundImage: "var(--gradient-brand)" }}>Create automation</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </header>

      <div className="grid gap-3">
        {items.map((a) => (
          <Card key={a.id} className="border-border/60">
            <CardContent className="flex items-center gap-6 p-5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary">
                <Workflow className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{a.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">WHEN</span>
                  <span>{a.when}</span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-50" />
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">THEN</span>
                  <span>{a.then}</span>
                </div>
              </div>
              <Switch
                checked={a.enabled}
                onCheckedChange={(v) => setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, enabled: v } : x)))}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}