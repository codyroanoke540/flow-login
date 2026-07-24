import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, ChevronDown, Circle, X } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useTerminology } from "@/lib/terminology";
import {
  getSession,
  listAccounts,
  listAvailability,
  listRecommendations,
  listResourceQualifications,
  listResources,
  listTimeOff,
  listWorkItems,
  updateOrgSettings,
} from "@/lib/cadence.functions";

type Step = {
  key: string;
  label: string;
  done: boolean;
  href: string;
};

type Warning = {
  key: string;
  label: string;
  href: string;
  count?: number;
};

export function SetupChecklist() {
  const qc = useQueryClient();
  const t = useTerminology();

  const sessionFn = useServerFn(getSession);
  const resFn = useServerFn(listResources);
  const availFn = useServerFn(listAvailability);
  const qualFn = useServerFn(listResourceQualifications);
  const timeOffFn = useServerFn(listTimeOff);
  const accFn = useServerFn(listAccounts);
  const wiFn = useServerFn(listWorkItems);
  const recFn = useServerFn(listRecommendations);
  const updateSettingsFn = useServerFn(updateOrgSettings);

  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => sessionFn() });
  const { data: resources = [] } = useQuery({ queryKey: ["resources"], queryFn: () => resFn() });
  const { data: availability = [] } = useQuery({ queryKey: ["availability"], queryFn: () => availFn() });
  const { data: quals = [] } = useQuery({ queryKey: ["resource_qualifications"], queryFn: () => qualFn() });
  const { data: timeOff = [] } = useQuery({ queryKey: ["time_off"], queryFn: () => timeOffFn() });
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => accFn() });
  const { data: items = [] } = useQuery({ queryKey: ["work_items"], queryFn: () => wiFn() });
  const { data: recs = [] } = useQuery({ queryKey: ["recommendations"], queryFn: () => recFn() });

  const [collapsed, setCollapsed] = useState(false);

  const org = (session as any)?.active_organization ?? null;
  const settings = (session as any)?.settings ?? null;
  const role = (session as any)?.role ?? null;
  const canManage = role === "owner" || role === "admin";
  const dismissedAt: string | null = settings?.onboarding_completed_at ?? null;

  const availByRes = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of availability as any[]) m.set(a.resource_id, (m.get(a.resource_id) ?? 0) + 1);
    return m;
  }, [availability]);

  const activeQualByRes = useMemo(() => {
    const m = new Map<string, number>();
    const today = new Date().toISOString().slice(0, 10);
    for (const q of quals as any[]) {
      if ((q.status ?? "active") !== "active") continue;
      if (q.expires_on && q.expires_on.slice(0, 10) < today) continue;
      m.set(q.resource_id, (m.get(q.resource_id) ?? 0) + 1);
    }
    return m;
  }, [quals]);

  const expiredQualByRes = useMemo(() => {
    const m = new Map<string, number>();
    const today = new Date().toISOString().slice(0, 10);
    for (const q of quals as any[]) {
      if (q.expires_on && q.expires_on.slice(0, 10) < today) m.set(q.resource_id, (m.get(q.resource_id) ?? 0) + 1);
    }
    return m;
  }, [quals]);

  const activeResources = (resources as any[]).filter((r) => r.status === "active");
  const resourcesWithAvail = activeResources.filter((r) => (availByRes.get(r.id) ?? 0) > 0);
  const resourcesWithSkillOrQual = activeResources.filter(
    (r) => (r.skills ?? []).length > 0 || (activeQualByRes.get(r.id) ?? 0) > 0,
  );
  const activeAccounts = (accounts as any[]).filter((a) => a.status !== "archived" && a.status !== "inactive");
  const accountsWithReqs = activeAccounts.filter(
    (a) => (a.required_skills ?? []).length > 0 || (a.required_qualifications ?? []).length > 0,
  );
  const openItems = (items as any[]).filter((i) => i.status !== "canceled");
  const unassignedItems = openItems.filter((i) => !i.assigned_resource_id && i.status !== "completed");
  const approvedRecs = (recs as any[]).filter((r) => r.status === "approved");
  const pendingRecs = (recs as any[]).filter((r) => r.status === "pending");
  const noMatchRecs = (recs as any[]).filter((r) => r.status === "no_match");
  const completedItems = openItems.filter((i) => i.status === "completed");
  const itemsAwaitingOutcome = openItems.filter(
    (i) => i.assigned_resource_id && i.status !== "completed" && new Date(i.scheduled_end ?? i.scheduled_start ?? 0) < new Date(),
  );

  const steps: Step[] = [
    {
      key: "org",
      label: `Confirm ${t.organization.toLowerCase()} name and time zone`,
      href: "/settings",
      done: !!org?.name && !!org?.timezone,
    },
    {
      key: "employee",
      label: `Add your first ${t.employee.toLowerCase()}`,
      href: "/employees",
      done: activeResources.length > 0,
    },
    {
      key: "availability",
      label: `Set weekly availability for a ${t.employee.toLowerCase()}`,
      href: "/employees",
      done: resourcesWithAvail.length > 0,
    },
    {
      key: "skills",
      label: `Add a skill or ${t.qualification.toLowerCase()} to a ${t.employee.toLowerCase()}`,
      href: "/employees",
      done: resourcesWithSkillOrQual.length > 0,
    },
    {
      key: "customer",
      label: `Add your first ${t.customer.toLowerCase()}`,
      href: "/customers",
      done: activeAccounts.length > 0,
    },
    {
      key: "customer-reqs",
      label: `Add service requirements to a ${t.customer.toLowerCase()}`,
      href: "/customers",
      done: accountsWithReqs.length > 0,
    },
    {
      key: "appointment",
      label: `Create the first ${t.appointment.toLowerCase()}`,
      href: "/schedule",
      done: openItems.length > 0,
    },
    {
      key: "recommendation",
      label: `Generate the first recommendation`,
      href: "/schedule",
      done: (recs as any[]).length > 0,
    },
    {
      key: "approval",
      label: `Approve the first assignment`,
      href: "/operations",
      done: approvedRecs.length > 0,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const pct = Math.round((doneCount / steps.length) * 100);

  const warnings: Warning[] = [];
  const missingAvail = activeResources.filter((r) => (availByRes.get(r.id) ?? 0) === 0).length;
  if (missingAvail > 0)
    warnings.push({ key: "w-avail", label: `${t.employees} missing availability`, href: "/employees", count: missingAvail });
  const expiredCount = Array.from(expiredQualByRes.values()).reduce((a, b) => a + b, 0);
  if (expiredCount > 0)
    warnings.push({ key: "w-exp", label: `Expired ${t.qualifications.toLowerCase()}`, href: "/employees", count: expiredCount });
  const missingReqs = activeAccounts.length - accountsWithReqs.length;
  if (activeAccounts.length > 0 && missingReqs > 0)
    warnings.push({ key: "w-reqs", label: `${t.customers} missing service requirements`, href: "/customers", count: missingReqs });
  if (unassignedItems.length > 0)
    warnings.push({ key: "w-unassigned", label: `Unassigned ${t.appointments.toLowerCase()}`, href: "/schedule", count: unassignedItems.length });
  if (noMatchRecs.length > 0)
    warnings.push({ key: "w-nomatch", label: `${t.appointments} with no eligible ${t.employee.toLowerCase()}`, href: "/operations", count: noMatchRecs.length });
  if (pendingRecs.length > 0)
    warnings.push({ key: "w-pending", label: `Pending recommendations`, href: "/operations", count: pendingRecs.length });
  if (itemsAwaitingOutcome.length - completedItems.length > 0)
    warnings.push({ key: "w-outcome", label: `${t.appointments} awaiting outcomes`, href: "/schedule", count: itemsAwaitingOutcome.length });
  // suppress duplicate metric noise
  void timeOff;

  const dismiss = useMutation({
    mutationFn: () => updateSettingsFn({ data: { onboarding_completed: true } }),
    onSuccess: () => {
      toast.success("Setup checklist dismissed");
      qc.invalidateQueries({ queryKey: ["session"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // Hide only when explicitly dismissed AND still complete.
  if (dismissedAt && allDone) return null;

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant={allDone ? "default" : "secondary"} className="text-[10px] uppercase tracking-wider">
              {allDone ? "Setup complete" : "Setup in progress"}
            </Badge>
            <span className="text-xs text-muted-foreground tabular-nums">{doneCount} of {steps.length}</span>
          </div>
          <CardTitle className="mt-2 font-display text-base font-semibold">
            {allDone ? `Your ${t.organization.toLowerCase()} is ready` : `Get your ${t.organization.toLowerCase()} operational`}
          </CardTitle>
          <div className="mt-3 max-w-md">
            <Progress value={pct} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCollapsed((c) => !c)}>
            <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
          </Button>
          {allDone && canManage && (
            <Button size="sm" variant="outline" onClick={() => dismiss.mutate()} disabled={dismiss.isPending}>
              <X className="mr-1.5 h-3.5 w-3.5" /> Dismiss
            </Button>
          )}
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-4">
          <ul className="grid gap-2 sm:grid-cols-2">
            {steps.map((s) => (
              <li key={s.key}>
                <Link
                  to={s.href}
                  className="flex items-start gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm hover:border-border/60 hover:bg-muted/40"
                >
                  {s.done ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={s.done ? "text-muted-foreground line-through" : ""}>{s.label}</span>
                </Link>
              </li>
            ))}
          </ul>

          {warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Needs attention
              </div>
              <ul className="grid gap-1 sm:grid-cols-2">
                {warnings.map((w) => (
                  <li key={w.key}>
                    <Link to={w.href} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-amber-500/10">
                      <span className="min-w-0 truncate">{w.label}</span>
                      {typeof w.count === "number" && (
                        <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                          {w.count}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}