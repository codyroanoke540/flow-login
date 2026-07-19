import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listAuditEvents } from "@/lib/cadence.functions";

export const Route = createFileRoute("/_authenticated/_app/audit")({
  head: () => ({ meta: [{ title: "Audit history — Cadence" }] }),
  component: AuditPage,
});

function AuditPage() {
  const fn = useServerFn(listAuditEvents);
  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ["audit_events"],
    queryFn: () => fn(),
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <History className="h-3.5 w-3.5" /> Audit history
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Every decision, recorded</h1>
        <p className="mt-1 text-muted-foreground">Append-only history of recommendations, approvals, and configuration changes.</p>
      </header>

      {error ? (
        <Card className="border-destructive/40">
          <CardContent className="py-8 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load audit history."}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
      ) : (events as any[]).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <h3 className="font-display text-lg font-semibold">Nothing recorded yet</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              As you add employees, create work items, and approve recommendations, every action will show up here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60">
          <CardContent className="divide-y p-0">
            {(events as any[]).map((e: any) => (
              <div key={e.id} className="flex flex-wrap items-start gap-3 px-4 py-3 text-sm">
                <Badge variant="outline" className="uppercase tracking-wider">{e.action}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    <span className="text-muted-foreground">{e.entity_type}</span>
                    {e.entity_id ? <span className="ml-1 text-xs text-muted-foreground">· {String(e.entity_id).slice(0, 8)}</span> : null}
                  </p>
                  {e.reason && <p className="text-xs text-muted-foreground">{e.reason}</p>}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div className="capitalize">{e.actor_role ?? "—"}</div>
                  <div className="tabular-nums">{new Date(e.created_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}