import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Sparkles, Wand2, Check, X, Pencil, Ban, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  approveRecommendation,
  cancelWorkItem,
  createWorkItem,
  listAccounts,
  listCandidates,
  listOutcomes,
  listResources,
  listWorkItems,
  previewCandidates,
  recordOutcome,
  rejectRecommendation,
  runRecommendation,
  updateWorkItem,
} from "@/lib/cadence.functions";
import { useTerminology } from "@/lib/terminology";

export const Route = createFileRoute("/_authenticated/_app/schedule")({
  head: () => ({ meta: [{ title: "Schedule — Cadence" }] }),
  component: SchedulePage,
});

type ItemForm = {
  id?: string;
  title: string;
  account_id: string;
  type: string;
  required_skills: string[];
  required_qualifications: string[];
  duration_minutes: number;
  priority: number;
  scheduled_start: string;
  scheduled_end: string;
  notes: string;
};

function emptyItem(): ItemForm {
  return { title: "", account_id: "", type: "appointment", required_skills: [], required_qualifications: [], duration_minutes: 60, priority: 3, scheduled_start: "", scheduled_end: "", notes: "" };
}
function toLocal(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromItem(i: any): ItemForm {
  return {
    id: i.id,
    title: i.title ?? "",
    account_id: i.account_id ?? "",
    type: i.type ?? "appointment",
    required_skills: i.required_skills ?? [],
    required_qualifications: i.required_qualifications ?? [],
    duration_minutes: Number(i.duration_minutes ?? 60),
    priority: Number(i.priority ?? 3),
    scheduled_start: toLocal(i.scheduled_start),
    scheduled_end: toLocal(i.scheduled_end),
    notes: i.notes ?? "",
  };
}

function serializeItem(input: ItemForm) {
  const start = input.scheduled_start ? new Date(input.scheduled_start).toISOString() : null;
  const end = input.scheduled_end
    ? new Date(input.scheduled_end).toISOString()
    : start ? new Date(new Date(start).getTime() + input.duration_minutes * 60_000).toISOString() : null;
  if (!start) throw new Error("Appointment start date and time are required");
  if (!end || new Date(end) <= new Date(start)) throw new Error("End must be after start");
  return {
    title: input.title.trim(),
    type: input.type.trim() || "appointment",
    account_id: input.account_id || null,
    required_skills: input.required_skills,
    required_qualifications: input.required_qualifications,
    duration_minutes: Math.max(1, Number(input.duration_minutes) || 60),
    priority: Math.min(5, Math.max(1, Number(input.priority) || 3)),
    scheduled_start: start,
    scheduled_end: end,
    notes: input.notes.trim() || null,
  };
}

function SchedulePage() {
  const t = useTerminology();
  const qc = useQueryClient();
  const listItemsFn = useServerFn(listWorkItems);
  const listResFn = useServerFn(listResources);
  const listAcctFn = useServerFn(listAccounts);
  const createFn = useServerFn(createWorkItem);
  const updateFn = useServerFn(updateWorkItem);
  const cancelFn = useServerFn(cancelWorkItem);
  const runFn = useServerFn(runRecommendation);
  const approveFn = useServerFn(approveRecommendation);
  const rejectFn = useServerFn(rejectRecommendation);
  const previewFn = useServerFn(previewCandidates);
  const listCandFn = useServerFn(listCandidates);
  const listOutcomesFn = useServerFn(listOutcomes);
  const recordOutcomeFn = useServerFn(recordOutcome);

  const { data: items = [] } = useQuery<any[]>({ queryKey: ["work_items"], queryFn: () => listItemsFn() });
  const { data: resources = [] } = useQuery<any[]>({ queryKey: ["resources"], queryFn: () => listResFn() });
  const { data: accounts = [] } = useQuery<any[]>({ queryKey: ["accounts"], queryFn: () => listAcctFn() });
  const { data: outcomes = [] } = useQuery<any[]>({ queryKey: ["outcomes"], queryFn: () => listOutcomesFn() });

  const resourceById = useMemo(() => new Map((resources as any[]).map((r) => [r.id, r])), [resources]);
  const accountById = useMemo(() => new Map((accounts as any[]).map((a) => [a.id, a])), [accounts]);
  const outcomeByWorkItem = useMemo(() => new Map((outcomes as any[]).map((o) => [o.work_item_id, o])), [outcomes]);

  const [editing, setEditing] = useState<ItemForm | null>(null);
  const [activeRec, setActiveRec] = useState<{ id: string; dto: any } | null>(null);
  const [outcomeItem, setOutcomeItem] = useState<any | null>(null);

  const saveMut = useMutation({
    mutationFn: (input: ItemForm) => {
      const base = serializeItem(input);
      return input.id
        ? updateFn({ data: { id: input.id, ...base } as any })
        : createFn({ data: base as any });
    },
    onSuccess: () => {
      toast.success("Work item saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["work_items"] });
      qc.invalidateQueries({ queryKey: ["recommendations"] });
      qc.invalidateQueries({ queryKey: ["audit_events"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const cancelMut = useMutation({
    mutationFn: (input: { id: string; reason: string }) => cancelFn({ data: input }),
    onSuccess: () => {
      toast.success("Work item canceled");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["work_items"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const outcomeMut = useMutation({
    mutationFn: (input: {
      work_item_id: string;
      final_status: "completed" | "canceled" | "no_show" | "failed";
      actual_resource_id?: string | null;
      actual_duration_minutes?: number | null;
      notes?: string | null;
    }) => recordOutcomeFn({ data: input }),
    onSuccess: () => {
      toast.success("Outcome recorded");
      setOutcomeItem(null);
      qc.invalidateQueries({ queryKey: ["work_items"] });
      qc.invalidateQueries({ queryKey: ["outcomes"] });
      qc.invalidateQueries({ queryKey: ["audit_events"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const runMut = useMutation({
    mutationFn: (id: string) => runFn({ data: { work_item_id: id } }),
    onSuccess: (res) => {
      const rec = res.recommendation as any;
      setActiveRec({ id: rec.id, dto: rec });
      if (!rec.selected_option?.resource_id) toast.warning("No eligible employee was found. Review the disqualification reasons.");
      qc.invalidateQueries({ queryKey: ["recommendations"] });
      qc.invalidateQueries({ queryKey: ["work_items"] });
      qc.invalidateQueries({ queryKey: ["audit_events"] });
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
      qc.invalidateQueries({ queryKey: ["audit_events"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => rejectFn({ data: { id } }),
    onSuccess: () => {
      toast.message("Recommendation rejected");
      setActiveRec(null);
      qc.invalidateQueries({ queryKey: ["recommendations"] });
      qc.invalidateQueries({ queryKey: ["work_items"] });
      qc.invalidateQueries({ queryKey: ["audit_events"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const { data: candidatesForRec = [] } = useQuery<any[]>({
    queryKey: ["recommendation_candidates", activeRec?.id],
    queryFn: () => listCandFn({ data: { recommendation_id: activeRec!.id } }),
    enabled: !!activeRec?.id,
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Schedule</h1>
          <p className="mt-1 text-muted-foreground">Every {t.appointment.toLowerCase()} routed through the Cadence decision engine.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="text-white" style={{ backgroundImage: "var(--gradient-brand)" }} onClick={() => setEditing(emptyItem())}>
            <Plus className="mr-1.5 h-4 w-4" /> New {t.appointment.toLowerCase()}
          </Button>
        </div>
      </header>

      {items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <h3 className="font-display text-lg font-semibold">No {t.appointments.toLowerCase()} yet</h3>
            <p className="max-w-md text-sm text-muted-foreground">Add {t.employees.toLowerCase()} and {t.customers.toLowerCase()}, then create your first {t.appointment.toLowerCase()} — Cadence will recommend the best assignment.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60">
          <CardContent className="divide-y p-0">
            {(items as any[]).map((a) => {
              const resource: any = a.assigned_resource_id ? resourceById.get(a.assigned_resource_id) : null;
              const account: any = a.account_id ? accountById.get(a.account_id) : null;
              const when = a.scheduled_start ? new Date(a.scheduled_start).toLocaleString() : "Unscheduled";
              const until = a.scheduled_end ? new Date(a.scheduled_end).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;
              const canRecommend = !!a.scheduled_start && a.status !== "assigned" && a.status !== "scheduled" && a.status !== "completed" && a.status !== "canceled";
              const outcome: any = outcomeByWorkItem.get(a.id);
              const canRecordOutcome = !outcome && ["assigned", "scheduled", "in_progress"].includes(a.status);
              return (
                <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5">
                  <div className="w-full font-display text-sm tabular-nums text-muted-foreground sm:w-52">{when}{until ? ` – ${until}` : ""}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {(a.status === "assigned" || a.status === "scheduled") && <Sparkles className="h-3.5 w-3.5 text-primary" />}
                      {a.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {account?.name ?? "No customer"} · {a.duration_minutes}m · P{a.priority}
                      {resource ? ` · ${resource.name}` : " · Unassigned"}
                    </div>
                  </div>
                  <Badge variant={a.status === "assigned" || a.status === "scheduled" ? "default" : a.status === "canceled" ? "outline" : "secondary"} className="text-[10px] uppercase tracking-wider">
                    {outcome?.actual_result?.final_status ?? a.status}
                  </Badge>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="ghost" aria-label={`Edit ${a.title}`} onClick={() => setEditing(fromItem(a))}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {canRecommend && (
                      <Button size="sm" variant="outline" disabled={runMut.isPending} onClick={() => runMut.mutate(a.id)}>
                        <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Recommend
                      </Button>
                    )}
                    {canRecordOutcome && (
                      <Button size="sm" variant="outline" onClick={() => setOutcomeItem(a)}>
                        <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" /> Outcome
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {editing && (
        <WorkItemSheet
          form={editing}
          accounts={accounts as any[]}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={() => saveMut.mutate(editing)}
          onCancelWorkItem={(reason) => editing.id && cancelMut.mutate({ id: editing.id, reason })}
          saving={saveMut.isPending}
          previewFn={previewFn}
        />
      )}

      {outcomeItem && (
        <OutcomeSheet
          item={outcomeItem}
          resources={resources as any[]}
          saving={outcomeMut.isPending}
          onClose={() => setOutcomeItem(null)}
          onSave={(data) => outcomeMut.mutate(data)}
        />
      )}

      <Sheet open={!!activeRec} onOpenChange={(o) => !o && setActiveRec(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Recommendation
            </SheetTitle>
            <SheetDescription>Every eligible employee, with disqualification reasons for the rest. Approve to update the schedule.</SheetDescription>
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
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Candidates ({candidatesForRec.length})</p>
                <div className="mt-2 space-y-2">
                  {candidatesForRec.map((c: any) => (
                    <div key={c.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{c.rank ? `#${c.rank} · ` : ""}{c.resource_name}</span>
                        <Badge variant={c.eligible ? "default" : "outline"} className="text-[10px]">
                          {c.eligible ? `score ${Number(c.weighted_score ?? 0).toFixed(2)}` : "disqualified"}
                        </Badge>
                      </div>
                      {!c.eligible && Array.isArray(c.disqualification_reasons) && c.disqualification_reasons.length > 0 && (
                        <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                          {c.disqualification_reasons.map((d: any, i: number) => <li key={i}>{d.detail ?? d.code}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {!activeRec.dto.selected_option?.resource_id && (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
                  No employee passed every hard constraint. Edit the appointment or employee availability, skills, qualifications, or time off, then run a new recommendation.
                </p>
              )}
              <SheetFooter className="mt-4 gap-2">
                <Button variant="outline" onClick={() => rejectMut.mutate(activeRec.id)} disabled={rejectMut.isPending}>
                  <X className="mr-1.5 h-3.5 w-3.5" /> Reject
                </Button>
                <Button
                  className="text-white"
                  style={{ backgroundImage: "var(--gradient-brand)" }}
                  disabled={approveMut.isPending || !activeRec.dto.selected_option?.resource_id}
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

function OutcomeSheet({
  item, resources, saving, onClose, onSave,
}: {
  item: any;
  resources: any[];
  saving: boolean;
  onClose: () => void;
  onSave: (data: {
    work_item_id: string;
    final_status: "completed" | "canceled" | "no_show" | "failed";
    actual_resource_id?: string | null;
    actual_duration_minutes?: number | null;
    notes?: string | null;
  }) => void;
}) {
  const [finalStatus, setFinalStatus] = useState<"completed" | "canceled" | "no_show" | "failed">("completed");
  const [resourceId, setResourceId] = useState(item.assigned_resource_id ?? "");
  const [duration, setDuration] = useState(String(item.duration_minutes ?? 60));
  const [notes, setNotes] = useState("");

  const submit = () => {
    const minutes = Number(duration);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      toast.error("Actual duration must be a positive whole number");
      return;
    }
    onSave({
      work_item_id: item.id,
      final_status: finalStatus,
      actual_resource_id: resourceId || null,
      actual_duration_minutes: minutes,
      notes: notes.trim() || null,
    });
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Record outcome</SheetTitle>
          <SheetDescription>Close {item.title} with what actually happened. This becomes part of the audit trail.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Final status</Label>
            <Select value={finalStatus} onValueChange={(value) => setFinalStatus(value as typeof finalStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="no_show">No show</SelectItem>
                <SelectItem value="failed">Failed / could not complete</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Employee who handled it</Label>
            <Select value={resourceId || "none"} onValueChange={(value) => setResourceId(value === "none" ? "" : value)}>
              <SelectTrigger><SelectValue placeholder="Not recorded" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not recorded</SelectItem>
                {resources.map((resource) => (
                  <SelectItem key={resource.id} value={resource.id}>{resource.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Actual duration (minutes)</Label>
            <Input type="number" min={1} max={1440} step={1} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What changed or needs follow-up?" />
          </div>
        </div>
        <SheetFooter className="mt-6 gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button
            className="text-white"
            style={{ backgroundImage: "var(--gradient-brand)" }}
            disabled={saving}
            onClick={submit}
          >
            {saving ? "Recording…" : "Record outcome"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function WorkItemSheet({
  form, accounts, onChange, onClose, onSave, onCancelWorkItem, saving, previewFn,
}: {
  form: ItemForm;
  accounts: any[];
  onChange: (f: ItemForm) => void;
  onClose: () => void;
  onSave: () => void;
  onCancelWorkItem: (reason: string) => void;
  saving: boolean;
  previewFn: (args: { data: { work_item_id: string; draft?: Record<string, unknown> } }) => Promise<any[]>;
}) {
  const [skillInput, setSkillInput] = useState("");
  const [qualInput, setQualInput] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [candidates, setCandidates] = useState<any[] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const update = (patch: Partial<ItemForm>) => {
    setCandidates(null);
    onChange({ ...form, ...patch });
  };

  // Auto-compute end from start+duration when user hasn't set end
  useEffect(() => {
    if (form.scheduled_start && !form.scheduled_end) {
      const d = new Date(form.scheduled_start);
      d.setMinutes(d.getMinutes() + form.duration_minutes);
      const pad = (n: number) => String(n).padStart(2, "0");
      onChange({
        ...form,
        scheduled_end: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.scheduled_start, form.duration_minutes]);

  const loadPreview = async () => {
    if (!form.id) return;
    setLoadingPreview(true);
    try {
      const draft = serializeItem(form);
      const rows = await previewFn({ data: { work_item_id: form.id, draft } });
      setCandidates(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoadingPreview(false);
    }
  };

  const addSkill = () => {
    const s = skillInput.trim();
    if (!s || form.required_skills.includes(s)) { setSkillInput(""); return; }
    update({ required_skills: [...form.required_skills, s] });
    setSkillInput("");
  };
  const addQual = () => {
    const s = qualInput.trim();
    if (!s || form.required_qualifications.includes(s)) { setQualInput(""); return; }
    update({ required_qualifications: [...form.required_qualifications, s] });
    setQualInput("");
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{form.id ? `Edit work item` : "New appointment"}</SheetTitle>
          <SheetDescription>Time, required skills, and qualifications drive eligibility. Cadence recommends only employees who satisfy every hard constraint.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-1.5"><Label>Title *</Label><Input value={form.title} onChange={(e) => update({ title: e.target.value })} placeholder="e.g. Home session" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <Select value={form.account_id} onValueChange={(v) => {
                const account = accounts.find((a) => a.id === v);
                const unique = (values: string[]) => Array.from(new Map(values.map((x) => [x.trim().toLowerCase(), x.trim()])).values()).filter(Boolean);
                update({
                  account_id: v,
                  required_skills: unique([...form.required_skills, ...(account?.required_skills ?? [])]),
                  required_qualifications: unique([...form.required_qualifications, ...(account?.required_qualifications ?? [])]),
                  duration_minutes: Number(account?.default_duration_minutes ?? form.duration_minutes),
                  scheduled_end: "",
                });
              }}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Type</Label><Input value={form.type} onChange={(e) => update({ type: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Start *</Label><Input type="datetime-local" value={form.scheduled_start} onChange={(e) => update({ scheduled_start: e.target.value, scheduled_end: "" })} /></div>
            <div className="space-y-1.5"><Label>End *</Label><Input type="datetime-local" value={form.scheduled_end} onChange={(e) => {
              const end = e.target.value;
              const startMs = form.scheduled_start ? new Date(form.scheduled_start).getTime() : Number.NaN;
              const endMs = end ? new Date(end).getTime() : Number.NaN;
              update({ scheduled_end: end, ...(Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs ? { duration_minutes: Math.round((endMs - startMs) / 60_000) } : {}) });
            }} /></div>
            <div className="space-y-1.5"><Label>Duration (min)</Label><Input type="number" min={1} value={form.duration_minutes} onChange={(e) => update({ duration_minutes: Number(e.target.value) || 60, scheduled_end: "" })} /></div>
            <div className="space-y-1.5"><Label>Priority (1–5)</Label><Input type="number" min={1} max={5} value={form.priority} onChange={(e) => update({ priority: Number(e.target.value) || 3 })} /></div>
          </div>

          <div className="space-y-1.5">
            <Label>Required skills</Label>
            <div className="flex flex-wrap gap-1.5">
              {form.required_skills.map((s) => (
                <Badge key={s} variant="secondary" className="gap-1 font-normal">
                  {s}
                  <button type="button" onClick={() => update({ required_skills: form.required_skills.filter((x) => x !== s) })}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
              {form.required_skills.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
            </div>
            <div className="flex gap-2">
              <Input value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }} placeholder="Add skill" />
              <Button type="button" variant="outline" onClick={addSkill}>Add</Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Required qualifications</Label>
            <div className="flex flex-wrap gap-1.5">
              {form.required_qualifications.map((s) => (
                <Badge key={s} className="gap-1 font-normal">
                  {s}
                  <button type="button" onClick={() => update({ required_qualifications: form.required_qualifications.filter((x) => x !== s) })}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
              {form.required_qualifications.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
            </div>
            <div className="flex gap-2">
              <Input value={qualInput} onChange={(e) => setQualInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addQual(); } }} placeholder="Add qualification code" />
              <Button type="button" variant="outline" onClick={addQual}>Add</Button>
            </div>
          </div>

          <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={(e) => update({ notes: e.target.value })} /></div>

          {form.id && (
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">Assignment preview</p>
                <Button size="sm" variant="outline" onClick={loadPreview} disabled={loadingPreview}>
                  {loadingPreview ? "Checking…" : candidates ? "Refresh" : "Check eligibility"}
                </Button>
              </div>
              {candidates && (
                <div className="mt-3 space-y-2">
                  {candidates.length === 0 && <p className="text-xs text-muted-foreground">No resources found.</p>}
                  {candidates.map((c: any) => (
                    <div key={c.resource_id} className="rounded-md border p-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{c.resource_name}</span>
                        <Badge variant={c.eligible ? "default" : "outline"} className="text-[10px]">
                          {c.eligible ? `score ${Number(c.score ?? 0).toFixed(2)}` : "ineligible"}
                        </Badge>
                      </div>
                      {!c.eligible && Array.isArray(c.disqualifiers) && c.disqualifiers.length > 0 && (
                        <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                          {c.disqualifiers.map((d: any, i: number) => <li key={i}>{d.detail ?? d.code}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {form.id && showCancel && (
            <div className="rounded-md border border-destructive/50 p-3">
              <p className="mb-2 text-sm font-medium">Cancel this work item?</p>
              <Textarea rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason (required)" />
              <div className="mt-2 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setShowCancel(false)}>Keep</Button>
                <Button size="sm" variant="destructive" disabled={!cancelReason.trim()} onClick={() => onCancelWorkItem(cancelReason.trim())}>
                  Cancel work item
                </Button>
              </div>
            </div>
          )}
        </div>
        <SheetFooter className="mt-6 flex-col gap-2 sm:flex-row">
          {form.id && !showCancel && (
            <Button variant="outline" onClick={() => setShowCancel(true)}>
              <Ban className="mr-1.5 h-3.5 w-3.5" /> Cancel
            </Button>
          )}
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button
              className="text-white"
              style={{ backgroundImage: "var(--gradient-brand)" }}
              onClick={onSave}
              disabled={!form.title.trim() || !form.scheduled_start || !form.scheduled_end || saving}
            >
              {saving ? "Saving…" : form.id ? "Save changes" : "Create"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}