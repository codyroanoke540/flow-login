import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { listAccounts, listResources, setAccountStatus, upsertAccount } from "@/lib/cadence.functions";

export const Route = createFileRoute("/_authenticated/_app/customers")({
  head: () => ({ meta: [{ title: "Customers — Cadence" }] }),
  component: CustomersPage,
});

type AccountForm = {
  id?: string;
  name: string;
  type: string;
  tier: string;
  status: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  service_address: string;
  city: string;
  state: string;
  zip: string;
  timezone: string;
  required_skills: string[];
  required_qualifications: string[];
  preferred_resource_ids: string[];
  default_duration_minutes: number;
  notes: string;
};

function emptyForm(): AccountForm {
  return {
    name: "", type: "customer", tier: "standard", status: "active",
    contact_name: "", contact_email: "", contact_phone: "",
    service_address: "", city: "", state: "", zip: "", timezone: "",
    required_skills: [], required_qualifications: [], preferred_resource_ids: [],
    default_duration_minutes: 60, notes: "",
  };
}
function fromRow(a: any): AccountForm {
  return {
    id: a.id,
    name: a.name ?? "",
    type: a.type ?? "customer",
    tier: a.tier ?? "standard",
    status: a.status ?? "active",
    contact_name: a.contact_name ?? "",
    contact_email: a.contact_email ?? "",
    contact_phone: a.contact_phone ?? "",
    service_address: a.service_address ?? "",
    city: a.city ?? "",
    state: a.state ?? "",
    zip: a.zip ?? "",
    timezone: a.timezone ?? "",
    required_skills: a.required_skills ?? [],
    required_qualifications: a.required_qualifications ?? [],
    preferred_resource_ids: a.preferred_resource_ids ?? [],
    default_duration_minutes: Number(a.default_duration_minutes ?? 60),
    notes: a.notes ?? "",
  };
}

function CustomersPage() {
  const listFn = useServerFn(listAccounts);
  const upsertFn = useServerFn(upsertAccount);
  const listResourcesFn = useServerFn(listResources);
  const statusFn = useServerFn(setAccountStatus);
  const qc = useQueryClient();
  const { data: accounts = [] } = useQuery<any[]>({ queryKey: ["accounts"], queryFn: () => listFn() });
  const { data: resources = [] } = useQuery<any[]>({ queryKey: ["resources"], queryFn: () => listResourcesFn() });
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<AccountForm | null>(null);

  const list = useMemo(
    () => (accounts as any[]).filter((c) => (c.name + " " + c.type + " " + c.tier).toLowerCase().includes(q.toLowerCase())),
    [accounts, q],
  );

  const saveMut = useMutation({
    mutationFn: (input: AccountForm) => upsertFn({ data: input as any }),
    onSuccess: () => {
      toast.success("Customer saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const statusMut = useMutation({
    mutationFn: (input: { id: string; status: "active" | "inactive" }) => statusFn({ data: input }),
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["accounts"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Customers</h1>
          <p className="mt-1 text-muted-foreground">Accounts Cadence schedules work for.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-9 w-56 rounded-lg pl-9 sm:w-64" />
          </div>
          <Button className="text-white" style={{ backgroundImage: "var(--gradient-brand)" }} onClick={() => setEditing(emptyForm())}>
            <Plus className="mr-1.5 h-4 w-4" /> Add customer
          </Button>
        </div>
      </header>

      {list.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <h3 className="font-display text-lg font-semibold">No customers yet</h3>
            <p className="max-w-md text-sm text-muted-foreground">Add your first account to start scheduling work against it.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40">
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden md:table-cell">Tier</TableHead>
                <TableHead className="hidden lg:table-cell">Required</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[1%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setEditing(fromRow(c))}>
                  <TableCell className="font-medium">
                    {c.name}
                    {c.contact_name && <div className="text-xs font-normal text-muted-foreground">{c.contact_name}</div>}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{c.type}</TableCell>
                  <TableCell className="hidden md:table-cell"><Badge variant="secondary" className="font-normal">{c.tier}</Badge></TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(c.required_skills ?? []).slice(0, 3).map((s: string) => <Badge key={s} variant="outline" className="font-normal">{s}</Badge>)}
                      {(c.required_qualifications ?? []).slice(0, 2).map((s: string) => <Badge key={s} className="font-normal">{s}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={c.status === "active" ? "default" : "outline"} className="font-normal">{c.status}</Badge></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(fromRow(c))}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost"
                        onClick={() => statusMut.mutate({ id: c.id, status: c.status === "active" ? "inactive" : "active" })}
                        disabled={statusMut.isPending}
                      >
                        {c.status === "active" ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {editing && (
        <AccountSheet
          form={editing}
          resources={resources as any[]}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={() => saveMut.mutate(editing)}
          saving={saveMut.isPending}
        />
      )}
    </div>
  );
}

function AccountSheet({
  form, resources, onChange, onClose, onSave, saving,
}: {
  form: AccountForm;
  resources: any[];
  onChange: (f: AccountForm) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [skillInput, setSkillInput] = useState("");
  const [qualInput, setQualInput] = useState("");
  const [preferredInput, setPreferredInput] = useState("");
  // Prevent stale-closure edits — always work off the current form
  useEffect(() => {}, [form]);
  const update = (patch: Partial<AccountForm>) => onChange({ ...form, ...patch });
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
          <SheetTitle>{form.id ? `Edit ${form.name}` : "Add customer"}</SheetTitle>
          <SheetDescription>Service requirements drive which employees Cadence considers eligible.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="Acme Inc." /></div>
            <div className="space-y-1.5"><Label>Type</Label><Input value={form.type} onChange={(e) => update({ type: e.target.value })} placeholder="customer" /></div>
            <div className="space-y-1.5"><Label>Tier</Label>
              <Select value={form.tier} onValueChange={(v) => update({ tier: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => update({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Contact name</Label><Input value={form.contact_name} onChange={(e) => update({ contact_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Contact email</Label><Input type="email" value={form.contact_email} onChange={(e) => update({ contact_email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Contact phone</Label><Input value={form.contact_phone} onChange={(e) => update({ contact_phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Timezone</Label><Input value={form.timezone} onChange={(e) => update({ timezone: e.target.value })} placeholder="America/New_York" /></div>
          </div>
          <div className="space-y-1.5"><Label>Service address</Label><Input value={form.service_address} onChange={(e) => update({ service_address: e.target.value })} /></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5"><Label>City</Label><Input value={form.city} onChange={(e) => update({ city: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>State</Label><Input value={form.state} onChange={(e) => update({ state: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>ZIP</Label><Input value={form.zip} onChange={(e) => update({ zip: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Required skills</Label>
            <div className="flex flex-wrap gap-1.5">
              {form.required_skills.map((s) => (
                <Badge key={s} variant="secondary" className="gap-1 font-normal">
                  {s}
                  <button type="button" onClick={() => update({ required_skills: form.required_skills.filter((x) => x !== s) })}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {form.required_skills.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
            </div>
            <div className="flex gap-2">
              <Input value={skillInput} onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                placeholder="e.g. Behavior Support" />
              <Button type="button" variant="outline" onClick={addSkill}>Add</Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Required qualifications</Label>
            <div className="flex flex-wrap gap-1.5">
              {form.required_qualifications.map((s) => (
                <Badge key={s} className="gap-1 font-normal">
                  {s}
                  <button type="button" onClick={() => update({ required_qualifications: form.required_qualifications.filter((x) => x !== s) })}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {form.required_qualifications.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
            </div>
            <div className="flex gap-2">
              <Input value={qualInput} onChange={(e) => setQualInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addQual(); } }}
                placeholder="e.g. RBT" />
              <Button type="button" variant="outline" onClick={addQual}>Add</Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Preferred employees</Label>
            <div className="flex flex-wrap gap-1.5">
              {form.preferred_resource_ids.map((id) => {
                const resource = resources.find((r) => r.id === id);
                return (
                  <Badge key={id} variant="outline" className="gap-1 font-normal">
                    {resource?.name ?? "Unknown employee"}
                    <button type="button" aria-label={`Remove ${resource?.name ?? "preferred employee"}`} onClick={() => update({ preferred_resource_ids: form.preferred_resource_ids.filter((x) => x !== id) })}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
              {form.preferred_resource_ids.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
            </div>
            <Select value={preferredInput} onValueChange={(id) => {
              setPreferredInput("");
              if (!form.preferred_resource_ids.includes(id)) update({ preferred_resource_ids: [...form.preferred_resource_ids, id] });
            }}>
              <SelectTrigger><SelectValue placeholder="Add a preferred employee" /></SelectTrigger>
              <SelectContent>
                {resources.filter((r) => r.status === "active" && !form.preferred_resource_ids.includes(r.id)).map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Default appointment duration (min)</Label>
            <Input type="number" min={1} value={form.default_duration_minutes}
              onChange={(e) => update({ default_duration_minutes: Number(e.target.value) || 60 })} />
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={(e) => update({ notes: e.target.value })} /></div>
        </div>
        <SheetFooter className="mt-6 flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="text-white"
            style={{ backgroundImage: "var(--gradient-brand)" }}
            onClick={onSave}
            disabled={!form.name.trim() || saving}
          >
            {saving ? "Saving…" : form.id ? "Save changes" : "Create customer"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}