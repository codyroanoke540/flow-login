import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  addResourceQualification,
  createTimeOff,
  deleteTimeOff,
  removeResourceQualification,
  setAvailability,
  upsertResource,
} from "@/lib/cadence.functions";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Slot = { weekday: number; start_time: string; end_time: string };

type ResourceInput = {
  id?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  type: string;
  skills: string[];
  weekly_capacity_hours: number;
  cost_rate: number;
  status: string;
  notes?: string | null;
};

type Props =
  | { mode: "create"; open: boolean; onOpenChange: (o: boolean) => void; onCreate: (data: ResourceInput) => void; creating: boolean }
  | {
      mode: "edit"; open: boolean; onOpenChange: (o: boolean) => void;
      resource: any; availability: any[]; qualifications: any[]; timeOff: any[];
    };

function emptyForm(): ResourceInput {
  return { name: "", email: "", phone: "", type: "employee", skills: [], weekly_capacity_hours: 40, cost_rate: 0, status: "active", notes: "" };
}

function fromResource(r: any): ResourceInput {
  return {
    id: r.id, name: r.name ?? "", email: r.email ?? "", phone: r.phone ?? "",
    type: r.type ?? "employee", skills: r.skills ?? [],
    weekly_capacity_hours: Number(r.weekly_capacity_hours ?? r.capacity ?? 40),
    cost_rate: Number(r.cost_rate ?? 0), status: r.status ?? "active", notes: r.notes ?? "",
  };
}

function timeToStr(t: string) { return t.length >= 5 ? t.slice(0, 5) : t; }

function validateSlots(slots: Slot[]): string | null {
  const byDay = new Map<number, Slot[]>();
  for (const s of slots) {
    if (s.start_time >= s.end_time) return `Invalid ${WEEKDAYS[s.weekday]} window: end must be after start.`;
    const list = byDay.get(s.weekday) ?? [];
    list.push(s);
    byDay.set(s.weekday, list);
  }
  for (const [day, list] of byDay) {
    const sorted = list.slice().sort((a, b) => a.start_time.localeCompare(b.start_time));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start_time < sorted[i - 1].end_time) {
        return `Overlapping windows on ${WEEKDAYS[day]}.`;
      }
      if (sorted[i].start_time === sorted[i - 1].start_time && sorted[i].end_time === sorted[i - 1].end_time) {
        return `Duplicate window on ${WEEKDAYS[day]}.`;
      }
    }
  }
  return null;
}

export function ResourceEditor(props: Props) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertResource);
  const setAvailFn = useServerFn(setAvailability);
  const addQualFn = useServerFn(addResourceQualification);
  const removeQualFn = useServerFn(removeResourceQualification);
  const createTimeOffFn = useServerFn(createTimeOff);
  const deleteTimeOffFn = useServerFn(deleteTimeOff);

  const editing = props.mode === "edit";
  const [form, setForm] = useState<ResourceInput>(() =>
    editing ? fromResource(props.resource) : emptyForm(),
  );
  const [skillInput, setSkillInput] = useState("");
  const [slots, setSlots] = useState<Slot[]>(() =>
    editing ? (props.availability ?? []).map((a: any) => ({ weekday: a.weekday, start_time: timeToStr(a.start_time), end_time: timeToStr(a.end_time) })) : [],
  );
  const [quals, setQuals] = useState<any[]>(() => (editing ? props.qualifications ?? [] : []));
  const [tos, setTos] = useState<any[]>(() => (editing ? props.timeOff ?? [] : []));
  const [newQual, setNewQual] = useState({ qualification_code: "", qualification_type: "", credential_number: "", expires_on: "", issued_on: "", status: "active" });
  const [newTo, setNewTo] = useState({ starts_at: "", ends_at: "", reason: "" });

  // Keep local state in sync when the source data changes (query refetch after mutations)
  useEffect(() => {
    if (editing) {
      setSlots((props.availability ?? []).map((a: any) => ({ weekday: a.weekday, start_time: timeToStr(a.start_time), end_time: timeToStr(a.end_time) })));
      setQuals(props.qualifications ?? []);
      setTos(props.timeOff ?? []);
    }
  }, [editing, props.mode === "edit" ? props.availability : null, props.mode === "edit" ? props.qualifications : null, props.mode === "edit" ? props.timeOff : null]);

  const saveDetailsMut = useMutation({
    mutationFn: (input: ResourceInput) => upsertFn({ data: input }),
    onSuccess: () => {
      toast.success("Employee saved");
      qc.invalidateQueries({ queryKey: ["resources"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const saveAvailMut = useMutation({
    mutationFn: (input: { resource_id: string; slots: Slot[] }) => setAvailFn({ data: input }),
    onSuccess: () => {
      toast.success("Availability saved");
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const addQualMut = useMutation({
    mutationFn: (input: any) => addQualFn({ data: input }),
    onSuccess: (saved: any) => {
      toast.success("Qualification added");
      setQuals((q) => [...q.filter((x) => x.id !== saved.id), saved]);
      setNewQual({ qualification_code: "", qualification_type: "", credential_number: "", expires_on: "", issued_on: "", status: "active" });
      qc.invalidateQueries({ queryKey: ["qualifications"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const removeQualMut = useMutation({
    mutationFn: (id: string) => removeQualFn({ data: { id } }),
    onSuccess: (_r, id) => {
      setQuals((q) => q.filter((x) => x.id !== id));
      qc.invalidateQueries({ queryKey: ["qualifications"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const addTimeOffMut = useMutation({
    mutationFn: (input: any) => createTimeOffFn({ data: input }),
    onSuccess: (saved: any) => {
      toast.success("Time off added");
      setTos((t) => [...t, saved]);
      setNewTo({ starts_at: "", ends_at: "", reason: "" });
      qc.invalidateQueries({ queryKey: ["time_off"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const removeTimeOffMut = useMutation({
    mutationFn: (id: string) => deleteTimeOffFn({ data: { id } }),
    onSuccess: (_r, id) => {
      setTos((t) => t.filter((x) => x.id !== id));
      qc.invalidateQueries({ queryKey: ["time_off"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const addSkill = () => {
    const s = skillInput.trim();
    if (!s) return;
    if (form.skills.map((x) => x.toLowerCase()).includes(s.toLowerCase())) { setSkillInput(""); return; }
    setForm((f) => ({ ...f, skills: [...f.skills, s] }));
    setSkillInput("");
  };
  const removeSkill = (s: string) => setForm((f) => ({ ...f, skills: f.skills.filter((x) => x !== s) }));

  const addSlot = (weekday: number) => {
    setSlots((prev) => [...prev, { weekday, start_time: "09:00", end_time: "17:00" }]);
  };
  const updateSlot = (idx: number, patch: Partial<Slot>) => {
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };
  const removeSlot = (idx: number) => setSlots((prev) => prev.filter((_, i) => i !== idx));

  const handleSaveDetails = () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    saveDetailsMut.mutate(form);
  };

  const handleSaveAvailability = () => {
    const err = validateSlots(slots);
    if (err) { toast.error(err); return; }
    if (!editing) return;
    saveAvailMut.mutate({ resource_id: props.resource.id, slots });
  };

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (props.mode !== "create") return;
    props.onCreate(form);
  };

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{editing ? `Edit ${props.resource.name}` : "Add employee"}</SheetTitle>
          <SheetDescription>
            {editing
              ? "Update details, skills, qualifications, availability, and time off. Every change is written to the audit log."
              : "Create the employee first, then add availability and qualifications so Cadence can consider them for assignments."}
          </SheetDescription>
        </SheetHeader>

        {!editing ? (
          <div className="mt-6 space-y-4">
            <DetailsFields form={form} setForm={setForm} skillInput={skillInput} setSkillInput={setSkillInput} addSkill={addSkill} removeSkill={removeSkill} />
            <SheetFooter className="mt-6 flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => props.onOpenChange(false)}>Cancel</Button>
              <Button
                className="text-white"
                style={{ backgroundImage: "var(--gradient-brand)" }}
                onClick={handleCreate}
                disabled={props.creating}
              >
                {props.creating ? "Creating…" : "Create employee"}
              </Button>
            </SheetFooter>
          </div>
        ) : (
          <Tabs defaultValue="details" className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="availability">Availability</TabsTrigger>
              <TabsTrigger value="quals">Qualifications</TabsTrigger>
              <TabsTrigger value="timeoff">Time off</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4 space-y-4">
              <DetailsFields form={form} setForm={setForm} skillInput={skillInput} setSkillInput={setSkillInput} addSkill={addSkill} removeSkill={removeSkill} />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => props.onOpenChange(false)}>Close</Button>
                <Button
                  className="text-white"
                  style={{ backgroundImage: "var(--gradient-brand)" }}
                  onClick={handleSaveDetails}
                  disabled={saveDetailsMut.isPending}
                >
                  {saveDetailsMut.isPending ? "Saving…" : "Save details"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="availability" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Add one or more windows per day. If a day has no windows the employee is unavailable that day. Employees with no availability configured cannot be assigned.
              </p>
              {WEEKDAYS.map((label, i) => {
                const daySlots = slots.map((s, idx) => ({ ...s, __idx: idx })).filter((s) => s.weekday === i);
                return (
                  <div key={i} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{label}</p>
                      <Button size="sm" variant="outline" onClick={() => addSlot(i)}>
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add window
                      </Button>
                    </div>
                    {daySlots.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Unavailable</p>}
                    {daySlots.map((s) => (
                      <div key={s.__idx} className="mt-2 flex flex-wrap items-center gap-2">
                        <Input
                          type="time"
                          value={s.start_time}
                          onChange={(e) => updateSlot(s.__idx, { start_time: e.target.value })}
                          className="w-32"
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input
                          type="time"
                          value={s.end_time}
                          onChange={(e) => updateSlot(s.__idx, { end_time: e.target.value })}
                          className="w-32"
                        />
                        <Button size="sm" variant="ghost" onClick={() => removeSlot(s.__idx)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                );
              })}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  className="text-white"
                  style={{ backgroundImage: "var(--gradient-brand)" }}
                  onClick={handleSaveAvailability}
                  disabled={saveAvailMut.isPending}
                >
                  {saveAvailMut.isPending ? "Saving…" : "Save availability"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="quals" className="mt-4 space-y-3">
              <div className="rounded-md border p-3">
                <p className="mb-2 font-medium">Add qualification</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1"><Label>Code / name</Label><Input value={newQual.qualification_code} onChange={(e) => setNewQual((q) => ({ ...q, qualification_code: e.target.value }))} placeholder="RBT" /></div>
                  <div className="space-y-1"><Label>Type</Label><Input value={newQual.qualification_type} onChange={(e) => setNewQual((q) => ({ ...q, qualification_type: e.target.value }))} placeholder="Certification" /></div>
                  <div className="space-y-1"><Label>Credential #</Label><Input value={newQual.credential_number} onChange={(e) => setNewQual((q) => ({ ...q, credential_number: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Issued</Label><Input type="date" value={newQual.issued_on} onChange={(e) => setNewQual((q) => ({ ...q, issued_on: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Expires on</Label><Input type="date" value={newQual.expires_on} onChange={(e) => setNewQual((q) => ({ ...q, expires_on: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Status</Label>
                    <Select value={newQual.status} onValueChange={(status) => setNewQual((q) => ({ ...q, status }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="revoked">Revoked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  className="mt-3"
                  disabled={!newQual.qualification_code || addQualMut.isPending}
                  onClick={() => {
                    if (newQual.issued_on && newQual.expires_on && newQual.expires_on < newQual.issued_on) {
                      toast.error("Expiration date cannot be before issue date");
                      return;
                    }
                    addQualMut.mutate({
                    resource_id: props.resource.id,
                    qualification_code: newQual.qualification_code,
                    qualification_type: newQual.qualification_type || null,
                    credential_number: newQual.credential_number || null,
                    issued_on: newQual.issued_on || null,
                    expires_on: newQual.expires_on || null,
                    status: newQual.status,
                  });
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
              </div>
              {quals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No qualifications recorded.</p>
              ) : (
                <div className="space-y-2">
                  {quals.map((q) => {
                    const today = new Date();
                    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                    const expired = q.expires_on && q.expires_on < todayKey;
                    const inactive = q.status && q.status !== "active";
                    return (
                      <div key={q.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{q.qualification_code} {q.qualification_type && <span className="text-xs text-muted-foreground">· {q.qualification_type}</span>}</p>
                          <p className="text-xs text-muted-foreground">
                            {q.credential_number && <>#{q.credential_number} · </>}
                            {q.issued_on && <>Issued {q.issued_on} · </>}
                            {q.expires_on ? <>Expires {q.expires_on}</> : "No expiration"}
                          </p>
                        </div>
                        {inactive && <Badge variant="outline" className="capitalize">{q.status}</Badge>}
                        {expired && <Badge variant="destructive">Expired</Badge>}
                        <Button size="sm" variant="ghost" onClick={() => removeQualMut.mutate(q.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="timeoff" className="mt-4 space-y-3">
              <div className="rounded-md border p-3">
                <p className="mb-2 font-medium">Add time off</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1"><Label>Starts</Label><Input type="datetime-local" value={newTo.starts_at} onChange={(e) => setNewTo((t) => ({ ...t, starts_at: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Ends</Label><Input type="datetime-local" value={newTo.ends_at} onChange={(e) => setNewTo((t) => ({ ...t, ends_at: e.target.value }))} /></div>
                  <div className="space-y-1 sm:col-span-2"><Label>Reason</Label><Input value={newTo.reason} onChange={(e) => setNewTo((t) => ({ ...t, reason: e.target.value }))} placeholder="Vacation" /></div>
                </div>
                <Button
                  className="mt-3"
                  disabled={!newTo.starts_at || !newTo.ends_at || addTimeOffMut.isPending}
                  onClick={() => {
                    if (new Date(newTo.ends_at) <= new Date(newTo.starts_at)) { toast.error("End must be after start"); return; }
                    addTimeOffMut.mutate({
                      resource_id: props.resource.id,
                      starts_at: new Date(newTo.starts_at).toISOString(),
                      ends_at: new Date(newTo.ends_at).toISOString(),
                      reason: newTo.reason || null,
                    });
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
              </div>
              {tos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No time off scheduled.</p>
              ) : (
                <div className="space-y-2">
                  {tos.map((t) => (
                    <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{new Date(t.starts_at).toLocaleString()} — {new Date(t.ends_at).toLocaleString()}</p>
                        {t.reason && <p className="text-xs text-muted-foreground">{t.reason}</p>}
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{t.status}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => removeTimeOffMut.mutate(t.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailsFields({
  form, setForm, skillInput, setSkillInput, addSkill, removeSkill,
}: {
  form: ResourceInput;
  setForm: (fn: (f: ResourceInput) => ResourceInput) => void;
  skillInput: string; setSkillInput: (s: string) => void;
  addSkill: () => void; removeSkill: (s: string) => void;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Full name *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Sarah Kim" /></div>
        <div className="space-y-1.5"><Label>Role / type</Label><Input value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} placeholder="Therapist" /></div>
        <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
        <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Weekly capacity (hrs)</Label><Input type="number" min={0} value={form.weekly_capacity_hours} onChange={(e) => setForm((f) => ({ ...f, weekly_capacity_hours: Number(e.target.value) || 0 }))} /></div>
        <div className="space-y-1.5"><Label>Cost rate ($/hr)</Label><Input type="number" min={0} value={form.cost_rate} onChange={(e) => setForm((f) => ({ ...f, cost_rate: Number(e.target.value) || 0 }))} /></div>
      </div>
      <div className="space-y-1.5">
        <Label>Skills</Label>
        <div className="flex flex-wrap gap-1.5">
          {form.skills.map((s) => (
            <Badge key={s} variant="secondary" className="gap-1 font-normal">
              {s}
              <button type="button" onClick={() => removeSkill(s)} aria-label={`Remove ${s}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {form.skills.length === 0 && <span className="text-xs text-muted-foreground">No skills yet</span>}
        </div>
        <div className="flex gap-2">
          <Input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
            placeholder="Type a skill and press Enter"
          />
          <Button type="button" variant="outline" onClick={addSkill}>Add</Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
      </div>
    </>
  );
}