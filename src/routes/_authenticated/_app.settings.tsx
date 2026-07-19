import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getSession, updateOrganization, updateOrgSettings } from "@/lib/cadence.functions";

export const Route = createFileRoute("/_authenticated/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — Cadence" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const sessionFn = useServerFn(getSession);
  const updOrgFn = useServerFn(updateOrganization);
  const updSetFn = useServerFn(updateOrgSettings);
  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => sessionFn() });

  const canManage = session?.role === "owner" || session?.role === "admin";
  const org = (session?.active_organization as any) ?? null;
  const settings = (session?.settings as any) ?? null;
  const terminology = (settings?.terminology as Record<string, string> | null) ?? {};

  const [orgForm, setOrgForm] = useState({ name: "", website: "", timezone: "" });
  const [termForm, setTermForm] = useState({ customer: "", employee: "", appointment: "", organization: "" });

  useEffect(() => {
    if (org) setOrgForm({ name: org.name ?? "", website: org.website ?? "", timezone: org.timezone ?? "" });
  }, [org?.id]);
  useEffect(() => {
    setTermForm({
      customer: terminology.customer ?? "",
      employee: terminology.employee ?? "",
      appointment: terminology.appointment ?? "",
      organization: terminology.organization ?? "",
    });
  }, [settings?.org_id]);

  const saveOrg = useMutation({
    mutationFn: () => updOrgFn({
      data: {
        name: orgForm.name.trim() || undefined,
        website: orgForm.website.trim() ? orgForm.website.trim() : null,
        timezone: orgForm.timezone.trim() || undefined,
      },
    }),
    onSuccess: () => { toast.success("Organization updated"); qc.invalidateQueries({ queryKey: ["session"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const saveTerm = useMutation({
    mutationFn: () => {
      const t: Record<string, string> = {};
      for (const [k, v] of Object.entries(termForm)) if (v.trim()) t[k] = v.trim();
      return updSetFn({ data: { terminology: t } });
    },
    onSuccess: () => { toast.success("Terminology updated"); qc.invalidateQueries({ queryKey: ["session"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">Organization details, industry terminology, and your role.</p>
      </header>

      <Tabs defaultValue="organization">
        <TabsList>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="terminology">Terminology</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="mt-6">
          <Card className="border-border/60">
            <CardHeader><CardTitle className="font-display text-base">Organization details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Organization name</Label>
                <Input value={orgForm.name} onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))} disabled={!canManage} />
              </div>
              <div className="space-y-1.5">
                <Label>Time zone</Label>
                <Input value={orgForm.timezone} onChange={(e) => setOrgForm((f) => ({ ...f, timezone: e.target.value }))} placeholder="America/Los_Angeles" disabled={!canManage} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Website</Label>
                <Input value={orgForm.website} onChange={(e) => setOrgForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://…" disabled={!canManage} />
              </div>
              <div className="sm:col-span-2">
                <Button
                  onClick={() => saveOrg.mutate()}
                  disabled={!canManage || saveOrg.isPending}
                  className="text-white"
                  style={{ backgroundImage: "var(--gradient-brand)" }}
                >
                  {saveOrg.isPending ? "Saving…" : "Save changes"}
                </Button>
                {!canManage && <p className="mt-2 text-xs text-muted-foreground">Only owners or admins can edit organization details.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terminology" className="mt-6">
          <Card className="border-border/60">
            <CardHeader><CardTitle className="font-display text-base">Industry terminology</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {(["customer", "employee", "appointment", "organization"] as const).map((k) => (
                <div key={k} className="space-y-1.5">
                  <Label className="capitalize">{k} label</Label>
                  <Input
                    value={termForm[k]}
                    onChange={(e) => setTermForm((f) => ({ ...f, [k]: e.target.value }))}
                    placeholder={k.charAt(0).toUpperCase() + k.slice(1)}
                    disabled={!canManage}
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Override the default nouns for your industry. Leave blank to use the default.
              </p>
              <div className="sm:col-span-2">
                <Button
                  onClick={() => saveTerm.mutate()}
                  disabled={!canManage || saveTerm.isPending}
                  className="text-white"
                  style={{ backgroundImage: "var(--gradient-brand)" }}
                >
                  {saveTerm.isPending ? "Saving…" : "Save terminology"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="mt-6">
          <Card className="border-border/60">
            <CardHeader><CardTitle className="font-display text-base">Your account</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{(session?.profile as any)?.email ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span className="font-medium capitalize">{session?.role ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Organization</span><span className="font-medium">{org?.name ?? "—"}</span></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}