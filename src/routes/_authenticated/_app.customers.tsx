import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { customers } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/_app/customers")({
  head: () => ({ meta: [{ title: "Customers — Cadence" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const [q, setQ] = useState("");
  const list = useMemo(
    () => customers.filter((c) => (c.name + c.contact + c.location + c.tags.join(" ")).toLowerCase().includes(q.toLowerCase())),
    [q],
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Customers</h1>
          <p className="mt-1 text-muted-foreground">Every account, ranked by activity and value.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-9 w-64 rounded-lg pl-9" />
          </div>
          <Button className="text-white" style={{ backgroundImage: "var(--gradient-brand)" }}>
            <Plus className="mr-1.5 h-4 w-4" /> Add customer
          </Button>
        </div>
      </header>

      <Card className="overflow-hidden border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/40">
              <TableHead>Customer</TableHead>
              <TableHead>Primary contact</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Last appointment</TableHead>
              <TableHead className="text-right">Lifetime value</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((c) => (
              <TableRow key={c.id} className="cursor-pointer">
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.contact}</TableCell>
                <TableCell className="text-muted-foreground">{c.location}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((t) => <Badge key={t} variant="secondary" className="font-normal">{t}</Badge>)}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.lastAppointment}</TableCell>
                <TableCell className="text-right tabular-nums">{c.ltv}</TableCell>
                <TableCell>
                  <Badge variant={c.status === "Active" ? "default" : "outline"} className="font-normal">{c.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}