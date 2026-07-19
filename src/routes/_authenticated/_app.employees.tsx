import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { listResources, setResourceStatus, upsertResource } from "@/lib/cadence.functions";

export const Route = createFileRoute("/_authenticated/_app/employees")({
  head: () => ({ meta: [{ title: "Employees — Cadence" }] }),
  component: EmployeesPage,
});

function initialsOf(name: string) {
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function EmployeesPage() {
  const listFn = useServerFn(listResources);
  const upsertFn = useServerFn(upsertResource);
  const statusFn = useServerFn(setResourceStatus);
  const qc = useQueryClient();
  const { data: resources = [] } = useQuery({ queryKey: ["resources"], queryFn: () => listFn() });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "employee", skills: "", capacity: 40, cost_rate: 0 });

  const list = useMemo(
    () => resources.filter((r) =>
      (r.name + r.type + (r.skills ?? []).join(" ")).toLowerCase().includes(q.toLowerCase()),
    ),
    [resources, q],
  );

  const createMut = useMutation({
    mutationFn: (input: typeof form) => upsertFn({
      data: {
        name: input.name,
        type: input.type,
        skills: input.skills.split(",").map((s) => s.trim()).filter(Boolean),
        weekly_capacity_hours: Number(input.capacity) || 40,
        cost_rate: Number(input.cost_rate) || 0,
      },
    }),
    onSuccess: () => {
      toast.success("Employee added");
      setOpen(false);
      setForm({ name: "", type: "employee", skills: "", capacity: 40, cost_rate: 0 });
      qc.invalidateQueries({ queryKey: ["resources"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const statusMut = useMutation({
    mutationFn: (input: { id: string; status: "active" | "inactive" }) => statusFn({ data: input }),
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["resources"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Employees</h1>
          <p className="mt-1 text-muted-foreground">Your workforce — the resource pool Cadence assigns from.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-9 w-64 rounded-lg pl-9" />
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button className="text-white" style={{ backgroundImage: "var(--gradient-brand)" }}>
                <Plus className="mr-1.5 h-4 w-4" /> Add employee
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Add employee</SheetTitle>
                <SheetDescription>New team members become eligible for scheduling immediately.</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="space-y-1.5"><Label>Full name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Doe" /></div>
                <div className="space-y-1.5"><Label>Role / type</Label><Input value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} placeholder="Field Specialist" /></div>
                <div className="space-y-1.5"><Label>Skills (comma-separated)</Label><Input value={form.skills} onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))} placeholder="HVAC, plumbing, senior" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Capacity (hrs/wk)</Label><Input type="number" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))} /></div>
                  <div className="space-y-1.5"><Label>Cost rate ($/hr)</Label><Input type="number" value={form.cost_rate} onChange={(e) => setForm((f) => ({ ...f, cost_rate: Number(e.target.value) }))} /></div>
                </div>
              </div>
              <SheetFooter className="mt-6">
                <Button
                  disabled={!form.name || createMut.isPending}
                  onClick={() => createMut.mutate(form)}
                  className="w-full text-white"
                  style={{ backgroundImage: "var(--gradient-brand)" }}
                >
                  {createMut.isPending ? "Creating…" : "Create employee"}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {list.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <h3 className="font-display text-lg font-semibold">No employees yet</h3>
            <p className="max-w-md text-sm text-muted-foreground">Add your first team member so Cadence can start recommending assignments.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((e) => {
            const hours = Number(e.weekly_capacity_hours ?? e.capacity ?? 0);
            const active = e.status === "active";
            return (
              <Card key={e.id} className="border-border/60">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11"><AvatarFallback>{initialsOf(e.name)}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{e.name}</p>
                        <Badge variant={active ? "default" : "outline"} className="text-[10px] uppercase tracking-wider">{e.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{e.type} · {hours} hrs/wk · ${Number(e.cost_rate).toFixed(0)}/hr</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {(e.skills ?? []).map((s: string) => <Badge key={s} variant="secondary" className="font-normal">{s}</Badge>)}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={statusMut.isPending}
                      onClick={() => statusMut.mutate({ id: e.id, status: active ? "inactive" : "active" })}
                    >
                      {active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}