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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { listAccounts, upsertAccount } from "@/lib/cadence.functions";

export const Route = createFileRoute("/_authenticated/_app/customers")({
  head: () => ({ meta: [{ title: "Customers — Cadence" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const listFn = useServerFn(listAccounts);
  const upsertFn = useServerFn(upsertAccount);
  const qc = useQueryClient();
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => listFn() });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "customer", tier: "standard" });

  const list = useMemo(
    () => accounts.filter((c) => (c.name + c.type + c.tier).toLowerCase().includes(q.toLowerCase())),
    [accounts, q],
  );

  const createMut = useMutation({
    mutationFn: (input: typeof form) => upsertFn({ data: input }),
    onSuccess: () => {
      toast.success("Customer added");
      setOpen(false);
      setForm({ name: "", type: "customer", tier: "standard" });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Customers</h1>
          <p className="mt-1 text-muted-foreground">Accounts Cadence schedules work for.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-9 w-64 rounded-lg pl-9" />
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button className="text-white" style={{ backgroundImage: "var(--gradient-brand)" }}>
                <Plus className="mr-1.5 h-4 w-4" /> Add customer
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Add customer</SheetTitle>
                <SheetDescription>Customers become available for new work items immediately.</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Acme Inc." /></div>
                <div className="space-y-1.5"><Label>Type</Label><Input value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} placeholder="customer" /></div>
                <div className="space-y-1.5"><Label>Tier</Label><Input value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))} placeholder="standard | premium | enterprise" /></div>
              </div>
              <SheetFooter className="mt-6">
                <Button
                  disabled={!form.name || createMut.isPending}
                  onClick={() => createMut.mutate(form)}
                  className="w-full text-white"
                  style={{ backgroundImage: "var(--gradient-brand)" }}
                >
                  {createMut.isPending ? "Creating…" : "Create customer"}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
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
                <TableHead>Type</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.type}</TableCell>
                  <TableCell><Badge variant="secondary" className="font-normal">{c.tier}</Badge></TableCell>
                  <TableCell><Badge variant={c.status === "active" ? "default" : "outline"} className="font-normal">{c.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}