import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { CalendarClock, Loader2, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Cadence" },
      { name: "description", content: "Sign in to your Cadence workspace to manage AI-powered scheduling for your team." },
      { property: "og:title", content: "Sign in — Cadence" },
      { property: "og:description", content: "Sign in to your Cadence workspace." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email({ message: "Enter a valid work email" }).max(255);
const passwordSchema = z.string().min(8, { message: "Password must be at least 8 characters" }).max(128);

const REMEMBER_KEY = "cadence.remember_email";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(REMEMBER_KEY);
    if (saved) setEmail(saved);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/operations" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      toast.error(emailResult.error.issues[0].message);
      return;
    }
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      toast.error(passwordResult.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: emailResult.data,
          password: passwordResult.data,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: {
              display_name: displayName.trim() || null,
              company_name: companyName.trim() || null,
            },
          },
        });
        if (signUpError) throw signUpError;
        // Auto-confirm is enabled on this pilot project, so signUp returns a
        // session directly. If not, sign in explicitly to establish one.
        if (!signUpData.session) {
          const { error: siError } = await supabase.auth.signInWithPassword({
            email: emailResult.data,
            password: passwordResult.data,
          });
          if (siError) {
            toast.success("Account created. Check your inbox to confirm your email.");
            return;
          }
        }
        if (remember) window.localStorage.setItem(REMEMBER_KEY, emailResult.data);
        toast.success("Welcome to Cadence.");
        navigate({ to: "/operations" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailResult.data,
          password: passwordResult.data,
        });
        if (error) {
          if (/Email not confirmed/i.test(error.message)) {
            throw new Error("Your account isn't confirmed yet. Please check your inbox for the confirmation email.");
          }
          throw error;
        }
        if (remember) window.localStorage.setItem(REMEMBER_KEY, emailResult.data);
        else window.localStorage.removeItem(REMEMBER_KEY);
        toast.success("Welcome back.");
        navigate({ to: "/operations" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-2 bg-background">
      {/* Brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white"
        style={{ backgroundImage: "var(--gradient-brand)" }}>
        <div aria-hidden className="absolute inset-0 opacity-70" style={{ backgroundImage: "var(--gradient-mesh)" }} />
        <div className="relative z-10 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <CalendarClock className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">Cadence</span>
        </div>

        <div className="relative z-10 max-w-md">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/20 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> AI Operations Platform
          </div>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            The AI Operating System<br />for service businesses.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-white/80">
            Cadence runs the operations of your business — scheduling, staffing,
            dispatch, and optimization — so your team can focus on the work.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-white/85">
            {[
              "Proactive AI recommendations across your operation",
              "Optimized scheduling, dispatch, and workforce planning",
              "Explainable recommendations with approval and audit history",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white/80" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-xs text-white/70">
          <ShieldCheck className="h-4 w-4" />
          Fictional-data pilot · Do not enter protected health information
        </div>
      </aside>

      {/* Form panel */}
      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="grid h-9 w-9 place-items-center rounded-lg text-white" style={{ backgroundImage: "var(--gradient-brand)" }}>
              <CalendarClock className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-semibold">Cadence</span>
          </div>

          <div className="mb-8">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
              {mode === "signin" ? "Welcome back" : "Create your organization"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Sign in to continue to your Cadence organization."
                : "Companies use Cadence to run secure, isolated organizations for their operations."}
            </p>
          </div>

          {/* Segmented toggle */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Your name</Label>
                  <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Cooper" maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="companyName">Company</Label>
                  <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Inc." maxLength={100} />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="pl-9" maxLength={255} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "signin" && (
                  <Link to="/forgot-password" className="text-xs font-medium text-foreground/80 hover:text-foreground underline-offset-4 hover:underline">
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className="pl-9" maxLength={128} />
              </div>
            </div>

            {mode === "signin" && (
              <div className="flex items-center gap-2">
                <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
                <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">Remember my email on this device</Label>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full text-sm font-medium text-white shadow-[var(--shadow-elegant)] transition hover:opacity-95"
              style={{ backgroundImage: "var(--gradient-brand)" }}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="mt-8">
            <Separator />
            <p className="mt-6 text-center text-xs text-muted-foreground">
              {mode === "signin" ? (
                <>New to Cadence?{" "}
                  <button type="button" onClick={() => setMode("signup")} className="font-medium text-foreground hover:underline underline-offset-4">
                    Create an account
                  </button>
                </>
              ) : (
                <>Already have an account?{" "}
                  <button type="button" onClick={() => setMode("signin")} className="font-medium text-foreground hover:underline underline-offset-4">
                    Sign in
                  </button>
                </>
              )}
            </p>
            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              Pilot access only. Use fictional data and do not enter protected health information.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}