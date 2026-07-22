import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Sparkles, Wand2, Check, X, Pencil, Ban } from "lucide-react";
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
  listResources,
  listWorkItems,
  previewCandidates,
  rejectRecommendation,
  runRecommendation,
  updateWorkItem,
} from "@/lib/cadence.functions";

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

function SchedulePage() {
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

  const { data: items = [] } = useQuery<any[]>({ queryKey: ["work_items"], queryFn: () => listItemsFn() });
  const { data: resources = [] } = useQuery<any[]>({ queryKey: ["resources"], queryFn: () => listResFn() });
  const { data: accounts = [] } = useQuery<any[]>({ queryKey: ["accounts"], queryFn: () => listAcctFn() });

  const resourceById = useMemo(() => new Map((resources as any[]).map((r) => [r.id, r])), [resources]);
  const accountById = useMemo(() => new Map((accounts as any[]).map((a) => [a.id, a])), [accounts]);

  const [editing, setEditing] = useState<ItemForm | null>(null);
  const [activeRec, setActiveRec] = useState<{ id: string; dto: any } | null>(null);

  const saveMut = useMutation({
    mutationFn: (input: ItemForm) => {
      const start = input.scheduled_start ? new Date(input.scheduled_start).toISOString() : null;
      const end = input.scheduled_end
        ? new Date(input.scheduled_end).toISOString()
        : start ? new Date(new Date(start).getTime() + input.duration_minutes * 60_000).toISOString() : null;
      if (start && end && new Date(end) <= new Date(start)) {
        throw new Error("End must be after start");
      }
      const base = {
        title: input.title,
        type: input.type,
        account_id: input.account_id || null,
        required_skills: input.required_skills,
        required_qualifications: input.required_qualifications,
        duration_minutes: Number(input.duration_minutes) || 60,
        priority: Number(input.priority) || 3,
        scheduled_start: start,
        scheduled_end: end,
        notes: input.notes || null,
      };
      return input.id
        ? updateFn({ data: { id: input.id, ...base } as any })
        : createFn({ data: base as any });
    },
    onSuccess: () => {
      toast.success("Work item saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["work_items"] });
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

  const runMut = useMutation({
    mutationFn: (id: string) => runFn({ data: { work_item_id: id } }),
    onSuccess: (res) => {
      const rec = res.recommendation as any;
      setActiveRec({ id: rec.id, dto: rec });
      qc.invalidateQueries({ queryKey: ["recommendations"] });
      qc.invalidateQueries({ queryKey: ["work_items"] });
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
          <p className="mt-1 text-muted-foreground">Every appointment routed through the Cadence decision engine.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="text-white" style={{ backgroundImage: "var(--gradient-brand)" }} onClick={() => setEditing(emptyItem())}>
            <Plus className="mr-1.5 h-4 w-4" /> New appointment
          </Button>
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
            {(items as any[]).map((a) => {
              const resource: any = a.assigned_resource_id ? resourceById.get(a.assigned_resource_id) : null;
              const account: any = a.account_id ? accountById.get(a.account_id) : null;
              const when = a.scheduled_start ? new Date(a.scheduled_start).toLocaleString() : "Unscheduled";
              const canRecommend = a.status !== "assigned" && a.status !== "scheduled" && a.status !== "completed" && a.status !== "canceled";
              return (
                <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5">
                  <div className="w-full font-display text-sm tabular-nums text-muted-foreground sm:w-40">{when}</div>
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
                  <Badge variant={a.status === "assigned" || a.status === "scheduled" ? "default" : a.status === "canceled" ? "outline" : "secondary"} className="text-[10px] uppercase tracking-wider">{a.status}</Badge>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(fromItem(a))}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {canRecommend && (
                      <Button size="sm" variant="outline" disabled={runMut.isPending} onClick={() => runMut.mutate(a.id)}>
                        <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Recommend
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
  previewFn: (args: { data: { work_item_id: string } }) => Promise<any[]>;
}) {
  const [skillInput, setSkillInput] = useState("");
  const [qualInput, setQualInput] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [candidates, setCandidates] = useState<any[] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const update = (patch: Partial<ItemForm>) => onChange({ ...form, ...patch });

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
      const rows = await previewFn({ data: { work_item_id: form.id } });
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
              <Select value={form.account_id} onValueChange={(v) => update({ account_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Type</Label><Input value={form.type} onChange={(e) => update({ type: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Start</Label><Input type="datetime-local" value={form.scheduled_start} onChange={(e) => update({ scheduled_start: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>End</Label><Input type="datetime-local" value={form.scheduled_end} onChange={(e) => update({ scheduled_end: e.target.value })} /></div>
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
              disabled={!form.title.trim() || saving}
            >
              {saving ? "Saving…" : form.id ? "Save changes" : "Create"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}