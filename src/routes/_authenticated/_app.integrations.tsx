import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { integrations } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/_app/integrations")({
  head: () => ({ meta: [{ title: "Integrations — Cadence" }] }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-1 text-muted-foreground">Connect the tools your operation already runs on.</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((i) => (
          <Card key={i.id} className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{i.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{i.desc}</p>
                </div>
                <span className="text-xs text-muted-foreground">{i.status}</span>
              </div>
              <Button variant="outline" size="sm" className="mt-4 w-full">Connect</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}