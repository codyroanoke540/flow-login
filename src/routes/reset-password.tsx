import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AlertCircle, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set new password — Cadence" }, { name: "description", content: "Choose a new password for your Cadence account." }] }),
  component: ResetPassword,
});

const passwordSchema = z.string().min(8, { message: "At least 8 characters" }).max(128);

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Supabase surfaces PASSWORD_RECOVERY when the user arrives via the
    // magic recovery link. If no recovery event happens and no session
    // is present, block the form and send them back to /forgot-password.
    const hash = window.location.hash;
    const looksRecovery = /type=recovery/.test(hash) || /type=recovery/.test(window.location.search);

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryReady(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (looksRecovery || data.session) setRecoveryReady(true);
      else setRecoveryReady(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recoveryReady) {
      toast.error("Open the reset link from your email to change your password.");
      return;
    }
    const result = passwordSchema.safeParse(password);
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: result.data });
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      navigate({ to: "/operations" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Set a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use at least 8 characters — a mix of letters, numbers, and symbols is strongest. Avoid passwords you've used elsewhere.
        </p>
        {recoveryReady === false && (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium text-foreground">Reset link required</p>
              <p className="mt-1 text-muted-foreground">
                To change your password, open the secure reset link from your email.{" "}
                <Link to="/forgot-password" className="font-medium text-foreground underline underline-offset-2">
                  Request a new one
                </Link>
                .
              </p>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" maxLength={128} disabled={!recoveryReady} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="pl-9" maxLength={128} disabled={!recoveryReady} />
            </div>
          </div>
          <Button type="submit" disabled={loading || !recoveryReady} className="h-11 w-full text-white" style={{ backgroundImage: "var(--gradient-brand)" }}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update password
          </Button>
        </form>
      </div>
    </main>
  );
}