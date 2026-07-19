import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Sparkles, Wand2, Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  approveRecommendation,
  createWorkItem,
  listAccounts,
  listResources,
  listWorkItems,
  rejectRecommendation,
  runRecommendation,
} from "@/lib/cadence.functions";

export const Route = createFileRoute("/_authenticated/_app/schedule")({
  head: () => ({ meta: [{ title: "Schedule — Cadence" }] }),
  component: SchedulePage,
});

function SchedulePage() {
  const qc = useQueryClient();
  const listItemsFn = useServerFn(listWorkItems);
  const listResFn = useServerFn(listResources);
  const listAcctFn = useServerFn(listAccounts);
  const createFn = useServerFn(createWorkItem);
  const runFn = useServerFn(runRecommendation);
  const approveFn = useServerFn(approveRecommendation);
  const rejectFn = useServerFn(rejectRecommendation);

  const { data: items = [] } = useQuery({ queryKey: ["work_items"], queryFn: () => listItemsFn() });
  const { data: resources = [] } = useQuery({ queryKey: ["resources"], queryFn: () => listResFn() });
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => listAcctFn() });

  const resourceById = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    account_id: "",
    required_skills: "",
    duration_minutes: 60,
    priority: 3,
    scheduled_start: "",
  });

  const [activeRec, setActiveRec] = useState<{ id: string; dto: any } | null>(null);

  const createMut = useMutation({
    mutationFn: (input: typeof form) => createFn({
      data: {
        title: input.title,
        account_id: input.account_id || undefined,
        required_skills: input.required_skills.split(",").map((s) => s.trim()).filter(Boolean),
        duration_minutes: Number(input.duration_minutes) || 60,
        priority: Number(input.priority) || 3,
        scheduled_start: input.scheduled_start ? new Date(input.scheduled_start).toISOString() : undefined,
      },
    }),
    onSuccess: () => {
      toast.success("Appointment created");
      setOpen(false);
      setForm({ title: "", account_id: "", required_skills: "", duration_minutes: 60, priority: 3, scheduled_start: "" });
      qc.invalidateQueries({ queryKey: ["work_items"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const runMut = useMutation({
    mutationFn: (id: string) => runFn({ data: { work_item_id: id } }),
    onSuccess: (res) => {
      const rec = res.recommendation as any;
      setActiveRec({ id: rec.id, dto: rec });
      qc.invalidateQueries({ queryKey: ["recommendations"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => approveFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Approved — schedule updated");
      setActiveRec(null);
      qc.invalidateQueries({ queryKey: ["work_items"] });
      qc.invalidateQueries({ queryKey: ["recommendations"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => rejectFn({ data: { id } }),
    onSuccess: () => { toast.message("Recommendation rejected"); setActiveRec(null); qc.invalidateQueries({ queryKey: ["recommendations"] }); },
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Schedule</h1>
          <p className="mt-1 text-muted-foreground">Every appointment routed through the Cadence decision engine.</p>
        </div>
        <div className="flex items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button className="text-white" style={{ backgroundImage: "var(--gradient-brand)" }}>
                <Plus className="mr-1.5 h-4 w-4" /> New appointment
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>New appointment</SheetTitle>
                <SheetDescription>Cadence will recommend the best employee to assign.</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Furnace tune-up" /></div>
                <div className="space-y-1.5">
                  <Label>Customer</Label>
                  <Select value={form.account_id} onValueChange={(v) => setForm((f) => ({ ...f, account_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Required skills (comma-separated)</Label><Input value={form.required_skills} onChange={(e) => setForm((f) => ({ ...f, required_skills: e.target.value }))} placeholder="HVAC, senior" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Duration (min)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))} /></div>
                  <div className="space-y-1.5"><Label>Priority (1–5)</Label><Input type="number" min={1} max={5} value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))} /></div>
                </div>
                <div className="space-y-1.5"><Label>Scheduled start</Label><Input type="datetime-local" value={form.scheduled_start} onChange={(e) => setForm((f) => ({ ...f, scheduled_start: e.target.value }))} /></div>
              </div>
              <SheetFooter className="mt-6">
                <Button
                  disabled={!form.title || createMut.isPending}
                  onClick={() => createMut.mutate(form)}
                  className="w-full text-white"
                  style={{ backgroundImage: "var(--gradient-brand)" }}
                >
                  {createMut.isPending ? "Creating…" : "Create appointment"}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <h3 className="font-display text-lg font-semibold">No appointments yet</h3>
            <p className="max-w-md text-sm text-muted-foreground">Add employees and customers, then create your first appointment — Cadence will recommend the best assignment.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60">
          <CardContent className="divide-y p-0">
            {items.map((a) => {
              const resource = a.assigned_resource_id ? resourceById.get(a.assigned_resource_id) : null;
              const account = a.account_id ? accountById.get(a.account_id) : null;
              const when = a.scheduled_start ? new Date(a.scheduled_start).toLocaleString() : "Unscheduled";
              return (
                <div key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="w-40 font-display text-sm tabular-nums text-muted-foreground">{when}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {a.status === "scheduled" && <Sparkles className="h-3.5 w-3.5 text-primary" />}
                      {a.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {account?.name ?? "No customer"} · {a.duration_minutes}m · P{a.priority}
                      {resource ? ` · ${resource.name}` : " · Unassigned"}
                    </div>
                  </div>
                  <Badge variant={a.status === "scheduled" ? "default" : "secondary"} className="text-[10px] uppercase tracking-wider">{a.status}</Badge>
                  {a.status !== "scheduled" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={runMut.isPending}
                      onClick={() => runMut.mutate(a.id)}
                    >
                      <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Recommend
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Sheet open={!!activeRec} onOpenChange={(o) => !o && setActiveRec(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Recommendation
            </SheetTitle>
            <SheetDescription>Cadence proposes this assignment. Approve to update the schedule.</SheetDescription>
          </SheetHeader>
          {activeRec && (
            <div className="mt-6 space-y-5 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Action</p>
                <p className="mt-1 font-medium">{activeRec.dto.selected_option?.action ?? "Assign best resource"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Confidence {activeRec.dto.confidence_score}%</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reasoning</p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{activeRec.dto.selected_option?.reasoning ?? activeRec.dto.reasoning?.text}</p>
              </div>
              {activeRec.dto.impact_assessment && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Impact</p>
                  <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground">{JSON.stringify(activeRec.dto.impact_assessment, null, 2)}</pre>
                </div>
              )}
              {Array.isArray(activeRec.dto.alternatives) && activeRec.dto.alternatives.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Alternatives</p>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    {activeRec.dto.alternatives.slice(0, 3).map((alt: any, i: number) => (
                      <li key={i}>· {alt.option ?? alt.action ?? JSON.stringify(alt)}{alt.score != null && ` — score ${alt.score}`}</li>
                    ))}
                  </ul>
                </div>
              )}
              <SheetFooter className="mt-4 gap-2">
                <Button variant="outline" onClick={() => rejectMut.mutate(activeRec.id)} disabled={rejectMut.isPending}>
                  <X className="mr-1.5 h-3.5 w-3.5" /> Reject
                </Button>
                <Button
                  className="text-white"
                  style={{ backgroundImage: "var(--gradient-brand)" }}
                  disabled={approveMut.isPending}
                  onClick={() => approveMut.mutate(activeRec.id)}
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" /> {approveMut.isPending ? "Applying…" : "Approve"}
                </Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}