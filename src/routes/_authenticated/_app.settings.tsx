import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — Cadence" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">Manage your organization, team, and platform preferences.</p>
      </header>

      <Tabs defaultValue="organization">
        <TabsList>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="terminology">Terminology</TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="mt-6">
          <Card className="border-border/60">
            <CardHeader><CardTitle className="font-display text-base">Organization details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Organization name</Label><Input defaultValue="Acme Operations" /></div>
              <div className="space-y-1.5"><Label>Time zone</Label><Input defaultValue="America/Los_Angeles" /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Website</Label><Input placeholder="https://" /></div>
              <div className="sm:col-span-2"><Button className="text-white" style={{ backgroundImage: "var(--gradient-brand)" }}>Save changes</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terminology" className="mt-6">
          <Card className="border-border/60">
            <CardHeader><CardTitle className="font-display text-base">Industry terminology</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Customer label</Label><Input defaultValue="Customer" /></div>
              <div className="space-y-1.5"><Label>Employee label</Label><Input defaultValue="Employee" /></div>
              <div className="space-y-1.5"><Label>Appointment label</Label><Input defaultValue="Appointment" /></div>
              <div className="space-y-1.5"><Label>Organization label</Label><Input defaultValue="Organization" /></div>
              <p className="text-xs text-muted-foreground sm:col-span-2">Change core nouns to match your industry — the entire product adapts.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {["members", "billing", "security"].map((v) => (
          <TabsContent key={v} value={v} className="mt-6">
            <Card className="border-border/60 border-dashed">
              <CardContent className="flex flex-col items-center gap-1 py-16 text-center">
                <h3 className="font-display text-lg font-semibold capitalize">{v}</h3>
                <p className="text-sm text-muted-foreground">This section will be available shortly.</p>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}