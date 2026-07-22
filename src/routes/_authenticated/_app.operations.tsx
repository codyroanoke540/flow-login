import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Info, Radar, Sparkles, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  approveRecommendation,
  listCandidates,
  listRecommendations,
  listResources,
  listWorkItems,
  rejectRecommendation,
} from "@/lib/cadence.functions";
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

export const Route = createFileRoute("/_authenticated/_app/operations")({
  head: () => ({ meta: [{ title: "Operations Center — Cadence" }] }),
  component: OperationsCenter,
});

function OperationsCenter() {
  const qc = useQueryClient();
  const listFn = useServerFn(listRecommendations);
  const approveFn = useServerFn(approveRecommendation);
  const rejectFn = useServerFn(rejectRecommendation);
  const listResFn = useServerFn(listResources);
  const listItemsFn = useServerFn(listWorkItems);
  const listCandFn = useServerFn(listCandidates);

  const { data: recs = [] } = useQuery({ queryKey: ["recommendations"], queryFn: () => listFn() });
  const { data: resources = [] } = useQuery({ queryKey: ["resources"], queryFn: () => listResFn() });
  const { data: items = [] } = useQuery({ queryKey: ["work_items"], queryFn: () => listItemsFn() });

  const [active, setActive] = useState<any | null>(null);
  const { data: candidates = [] } = useQuery({
    queryKey: ["recommendation_candidates", active?.id],
    queryFn: () => listCandFn({ data: { recommendation_id: active.id } }),
    enabled: !!active?.id,
  });

  const pending = (recs as any[]).filter((r) => r.status === "pending");
  const decided = (recs as any[]).filter((r) => r.status !== "pending").slice(0, 10);

  const approveMut = useMutation({
    mutationFn: (id: string) => approveFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Approved — schedule updated");
      qc.invalidateQueries({ queryKey: ["recommendations"] });
      qc.invalidateQueries({ queryKey: ["work_items"] });
      qc.invalidateQueries({ queryKey: ["audit_events"] });
      setActive(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) => rejectFn({ data: { id } }),
    onSuccess: () => {
      toast.message("Rejected");
      qc.invalidateQueries({ queryKey: ["recommendations"] });
      qc.invalidateQueries({ queryKey: ["audit_events"] });
      setActive(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const empty = (resources as any[]).length === 0 && (items as any[]).length === 0 && (recs as any[]).length === 0;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Radar className="h-3.5 w-3.5" /> Operations Center
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Command your operation</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Live recommendations and activity from the Cadence decision engine — nothing here is seeded or simulated.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">{pending.length} pending</span>
          <span aria-hidden>·</span>
          <span>Live</span>
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        </div>
      </header>

      {empty ? (
        <Card className="border-dashed">
          <CardContent className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="font-display text-lg font-semibold">No operational activity yet</h3>
            <p className="text-sm text-muted-foreground">
              Add employees and customers, then create a work item — the decision engine will surface a recommendation for you to approve here.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Link to="/employees"><Button variant="outline" size="sm">Add employees</Button></Link>
              <Link to="/customers"><Button variant="outline" size="sm">Add customers</Button></Link>
              <Link to="/schedule">
                <Button size="sm" className="text-white" style={{ backgroundImage: "var(--gradient-brand)" }}>
                  Create work item
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <section>
            <div className="mb-3">
              <h2 className="font-display text-lg font-semibold tracking-tight">Pending recommendations</h2>
              <p className="text-sm text-muted-foreground">Awaiting your approval — every decision revalidated server-side.</p>
            </div>
            {pending.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary">
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Nothing to approve. New recommendations appear here when you run one from the Schedule.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {pending.map((r: any) => {
                  const wi = (items as any[]).find((i) => i.id === r.work_item_id);
                  const resource = (resources as any[]).find((res) => res.id === r.selected_option?.resource_id);
                  const canApprove = !!r.selected_option?.resource_id && !!r.work_item_id;
                  return (
                    <Card key={r.id} className="border-border/60">
                      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">Decision Engine</Badge>
                            <span className="text-xs text-muted-foreground">{r.confidence_score}% confidence</span>
                          </div>
                          <CardTitle className="mt-2 font-display text-base font-semibold leading-snug">
                            {r.selected_option?.action ?? "Assignment proposal"}
                          </CardTitle>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {wi?.title ? `Work item: ${wi.title}` : "Work item"} · {resource?.name ? `Proposed: ${resource.name}` : "No resource selected"}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setActive(r)}>
                            <Info className="mr-1.5 h-3.5 w-3.5" /> Details
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => rejectMut.mutate(r.id)} disabled={rejectMut.isPending}>
                            <X className="mr-1.5 h-3.5 w-3.5" /> Reject
                          </Button>
                          <Button
                            size="sm"
                            className="text-white"
                            style={{ backgroundImage: "var(--gradient-brand)" }}
                            onClick={() => approveMut.mutate(r.id)}
                            disabled={approveMut.isPending || !canApprove}
                            title={canApprove ? undefined : "No eligible resource — review candidates and adjust availability or skills."}
                          >
                            <Check className="mr-1.5 h-3.5 w-3.5" /> Approve
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">
                        {!canApprove && (
                          <p className="mb-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                            No eligible resource. Open Details to see why each candidate was disqualified.
                          </p>
                        )}
                        {r.selected_option?.reasoning ?? r.reasoning?.text ?? r.trigger}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {decided.length > 0 && (
            <section>
              <div className="mb-3 flex items-end justify-between">
                <h2 className="font-display text-lg font-semibold tracking-tight">Recent decisions</h2>
                <Link to="/audit" className="text-sm text-muted-foreground hover:text-foreground">
                  View audit history <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
                </Link>
              </div>
              <Card className="border-border/60">
                <CardContent className="divide-y p-0">
                  {decided.map((r: any) => (
                    <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                      <Badge variant={r.status === "approved" ? "default" : "outline"} className="uppercase tracking-wider">
                        {r.status}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate">{r.selected_option?.action ?? "Assignment proposal"}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {new Date(r.updated_at ?? r.created_at).toLocaleString()}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => setActive(r)}>Details</Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          )}
        </>
      )}

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Recommendation details
            </SheetTitle>
            <SheetDescription>
              Every eligible resource and every hard-constraint disqualification from the deterministic engine.
            </SheetDescription>
          </SheetHeader>
          {active && (
            <div className="mt-6 space-y-6 text-sm">
              <section>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Recommended</p>
                <p className="mt-1 font-medium">{active.selected_option?.action ?? "Assignment"}</p>
                <p className="text-xs text-muted-foreground">
                  Confidence {active.confidence_score}%
                </p>
              </section>
              <section>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reasoning</p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {active.selected_option?.reasoning ?? active.reasoning?.text}
                </p>
              </section>
              <section>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Candidates ({(candidates as any[]).length})
                </p>
                <div className="mt-2 space-y-2">
                  {(candidates as any[]).length === 0 && (
                    <p className="text-xs text-muted-foreground">No candidate detail recorded.</p>
                  )}
                  {(candidates as any[]).map((c: any) => (
                    <div key={c.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {c.rank ? `#${c.rank} · ` : ""}{c.resource_name}
                        </span>
                        <Badge variant={c.eligible ? "default" : "outline"} className="text-[10px]">
                          {c.eligible ? `score ${Number(c.weighted_score ?? 0).toFixed(2)}` : "disqualified"}
                        </Badge>
                      </div>
                      {!c.eligible && Array.isArray(c.disqualification_reasons) && c.disqualification_reasons.length > 0 && (
                        <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                          {c.disqualification_reasons.map((d: any, i: number) => (
                            <li key={i}>{d.detail ?? d.code}</li>
                          ))}
                        </ul>
                      )}
                      {c.eligible && c.factor_scores && (
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          {Object.entries(c.factor_scores).map(([k, v]: any) => (
                            <div key={k} className="flex justify-between">
                              <span>{k}</span>
                              <span className="tabular-nums">{Number(v).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {c.explanation && <p className="mt-2 text-xs text-muted-foreground">{c.explanation}</p>}
                    </div>
                  ))}
                </div>
              </section>
              {active.status === "pending" && (
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  <Button variant="outline" onClick={() => rejectMut.mutate(active.id)} disabled={rejectMut.isPending}>
                    <X className="mr-1.5 h-3.5 w-3.5" /> Reject
                  </Button>
                  <Button
                    className="text-white"
                    style={{ backgroundImage: "var(--gradient-brand)" }}
                    onClick={() => approveMut.mutate(active.id)}
                    disabled={approveMut.isPending}
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Approve
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}