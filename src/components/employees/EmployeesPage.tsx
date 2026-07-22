import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  listResources,
  listAvailability,
  listResourceQualifications,
  listTimeOff,
  setResourceStatus,
  upsertResource,
} from "@/lib/cadence.functions";
import { ResourceEditor } from "./ResourceEditor";

function initialsOf(name: string) {
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function EmployeesPage() {
  const listFn = useServerFn(listResources);
  const listAvailFn = useServerFn(listAvailability);
  const listQualFn = useServerFn(listResourceQualifications);
  const listTimeOffFn = useServerFn(listTimeOff);
  const statusFn = useServerFn(setResourceStatus);
  const upsertFn = useServerFn(upsertResource);
  const qc = useQueryClient();

  const { data: resources = [] } = useQuery<any[]>({ queryKey: ["resources"], queryFn: () => listFn() });
  const { data: availability = [] } = useQuery<any[]>({ queryKey: ["availability"], queryFn: () => listAvailFn() });
  const { data: qualifications = [] } = useQuery<any[]>({ queryKey: ["qualifications"], queryFn: () => listQualFn() });
  const { data: timeOff = [] } = useQuery<any[]>({ queryKey: ["time_off"], queryFn: () => listTimeOffFn() });

  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  const list = useMemo(
    () => (resources as any[]).filter((r) =>
      (r.name + " " + r.type + " " + (r.skills ?? []).join(" ")).toLowerCase().includes(q.toLowerCase()),
    ),
    [resources, q],
  );

  const createMut = useMutation({
    mutationFn: (data: any) => upsertFn({ data }),
    onSuccess: (saved: any) => {
      toast.success("Employee created");
      setCreating(false);
      qc.invalidateQueries({ queryKey: ["resources"] });
      // Immediately open the editor for the new resource so users add availability/quals
      setEditing(saved);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const statusMut = useMutation({
    mutationFn: (input: { id: string; status: "active" | "inactive" }) => statusFn({ data: input }),
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["resources"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const availabilityCountByResource = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of availability as any[]) m.set(a.resource_id, (m.get(a.resource_id) ?? 0) + 1);
    return m;
  }, [availability]);

  const qualCountByResource = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of qualifications as any[]) m.set(q.resource_id, (m.get(q.resource_id) ?? 0) + 1);
    return m;
  }, [qualifications]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Employees</h1>
          <p className="mt-1 text-muted-foreground">The workforce Cadence assigns from. Availability and qualifications drive every recommendation.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-9 w-56 rounded-lg pl-9 sm:w-64" />
          </div>
          <Button className="text-white" style={{ backgroundImage: "var(--gradient-brand)" }} onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add employee
          </Button>
        </div>
      </header>

      {list.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <h3 className="font-display text-lg font-semibold">No employees yet</h3>
            <p className="max-w-md text-sm text-muted-foreground">Add your first team member so Cadence can recommend assignments. You'll set their skills, qualifications, and weekly availability next.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((e) => {
            const hours = Number(e.weekly_capacity_hours ?? e.capacity ?? 0);
            const active = e.status === "active";
            const availCount = availabilityCountByResource.get(e.id) ?? 0;
            const qualCount = qualCountByResource.get(e.id) ?? 0;
            const missingAvail = availCount === 0;
            return (
              <Card
                key={e.id}
                className="cursor-pointer border-border/60 transition hover:border-primary/30 hover:shadow-sm"
                onClick={() => setEditing(e)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11"><AvatarFallback>{initialsOf(e.name)}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{e.name}</p>
                        <Badge variant={active ? "default" : "outline"} className="text-[10px] uppercase tracking-wider">{e.status}</Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{e.type} · {hours} hrs/wk · ${Number(e.cost_rate).toFixed(0)}/hr</p>
                      {e.email && <p className="truncate text-xs text-muted-foreground">{e.email}</p>}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(e.skills ?? []).slice(0, 6).map((s: string) => <Badge key={s} variant="secondary" className="font-normal">{s}</Badge>)}
                    {(e.skills ?? []).length === 0 && <span className="text-xs text-muted-foreground">No skills</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className={missingAvail ? "text-amber-600 dark:text-amber-400" : ""}>
                      {missingAvail ? "⚠ No availability set" : `${availCount} availability window${availCount === 1 ? "" : "s"}`}
                    </span>
                    <span>{qualCount} qualification{qualCount === 1 ? "" : "s"}</span>
                  </div>
                  <div className="mt-4 flex justify-end gap-2" onClick={(evt) => evt.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={statusMut.isPending}
                      onClick={() => statusMut.mutate({ id: e.id, status: active ? "inactive" : "active" })}
                    >
                      {active ? "Deactivate" : "Reactivate"}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(e)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {creating && (
        <ResourceEditor
          mode="create"
          open={creating}
          onOpenChange={(o) => setCreating(o)}
          onCreate={(data) => createMut.mutate(data)}
          creating={createMut.isPending}
        />
      )}

      {editing && (
        <ResourceEditor
          mode="edit"
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          resource={editing}
          availability={(availability as any[]).filter((a) => a.resource_id === editing.id)}
          qualifications={(qualifications as any[]).filter((q) => q.resource_id === editing.id)}
          timeOff={(timeOff as any[]).filter((t) => t.resource_id === editing.id)}
        />
      )}
    </div>
  );
}