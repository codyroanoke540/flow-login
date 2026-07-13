import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
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
import { employees } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/_app/employees")({
  head: () => ({ meta: [{ title: "Employees — Cadence" }] }),
  component: EmployeesPage,
});

function statusTone(s: string) {
  if (s === "Working") return "bg-primary/10 text-primary";
  if (s === "Available") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  return "bg-muted text-muted-foreground";
}

function EmployeesPage() {
  const [q, setQ] = useState("");
  const list = useMemo(
    () => employees.filter((e) => (e.name + e.role + e.location + e.skills.join(" ")).toLowerCase().includes(q.toLowerCase())),
    [q],
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Employees</h1>
          <p className="mt-1 text-muted-foreground">Your workforce, at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-9 w-64 rounded-lg pl-9" />
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button className="text-white" style={{ backgroundImage: "var(--gradient-brand)" }}>
                <Plus className="mr-1.5 h-4 w-4" /> Add employee
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Add employee</SheetTitle>
                <SheetDescription>New team members appear in scheduling immediately.</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="space-y-1.5"><Label>Full name</Label><Input placeholder="Jane Doe" /></div>
                <div className="space-y-1.5"><Label>Role</Label><Input placeholder="Field Specialist" /></div>
                <div className="space-y-1.5"><Label>Primary location</Label><Input placeholder="North District" /></div>
                <div className="space-y-1.5"><Label>Email</Label><Input type="email" placeholder="jane@company.com" /></div>
              </div>
              <SheetFooter className="mt-6">
                <Button className="w-full text-white" style={{ backgroundImage: "var(--gradient-brand)" }}>Create employee</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((e) => (
          <Card key={e.id} className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Avatar className="h-11 w-11"><AvatarFallback>{e.initials}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{e.name}</p>
                    <span className={"rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider " + statusTone(e.status)}>{e.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{e.role} · {e.location}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {e.skills.map((s) => <Badge key={s} variant="secondary" className="font-normal">{s}</Badge>)}
                {e.certifications.map((c) => <Badge key={c} variant="outline" className="font-normal">{c}</Badge>)}
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Workload</span><span className="tabular-nums">{e.workload}%</span>
                </div>
                <Progress value={e.workload} className="h-1.5" />
              </div>

              {e.nextAppointment && (
                <p className="mt-3 text-xs text-muted-foreground">Next: <span className="text-foreground">{e.nextAppointment}</span></p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}