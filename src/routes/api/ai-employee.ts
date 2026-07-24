import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { ModelMessage } from "ai";

import { getProvider } from "@/lib/ai/providers";
import { AI_ROLES, DEFAULT_ROLE, type AiRoleId } from "@/lib/ai/roles";
import { buildToolsForRole } from "@/lib/ai/tools";

type Body = {
  messages?: ModelMessage[];
  role?: AiRoleId;
  pageContext?: { pathname?: string; title?: string; summary?: string };
  memory?: string;
};

async function requireUser(request: Request): Promise<{ userId: string; supabase: ReturnType<typeof createClient> }> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) throw new Error("Unauthorized");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("AI Employee is not configured");
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("Unauthorized");
  const userId = String(data.claims.sub);
  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("active_organization_id").eq("id", userId).maybeSingle();
  if (profileError || !profile?.active_organization_id) throw new Error("No active organization");
  const { data: membership, error: membershipError } = await supabase
    .from("org_members").select("id").eq("org_id", profile.active_organization_id)
    .eq("user_id", userId).eq("status", "active").maybeSingle();
  if (membershipError || !membership) throw new Error("Unauthorized");
  const { data: settings, error: settingsError } = await supabase
    .from("organization_settings").select("feature_flags").eq("org_id", profile.active_organization_id).maybeSingle();
  if (settingsError) throw new Error("AI Employee is not configured");
  const flags = (settings?.feature_flags ?? {}) as Record<string, unknown>;
  if (flags.ai_employee_enabled !== true) throw new Error("AI Employee is disabled");
  return { userId, supabase };
}

export const Route = createFileRoute("/api/ai-employee")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireUser(request);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unauthorized";
          const status = message === "Unauthorized" ? 401 : message === "AI Employee is disabled" ? 403 : 503;
          return new Response(message, { status });
        }

        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (contentLength > 100_000) return new Response("Request too large", { status: 413 });

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const messages = Array.isArray(body.messages) ? body.messages.slice(-30) : [];
        if (messages.length === 0) return new Response("messages required", { status: 400 });
        const serializedMessages = JSON.stringify(messages);
        if (serializedMessages.length > 80_000) return new Response("Messages too large", { status: 413 });

        const role = AI_ROLES[body.role ?? DEFAULT_ROLE] ?? AI_ROLES[DEFAULT_ROLE];
        const pageCtx = body.pageContext ?? {};
        const ctxLine = pageCtx.pathname
          ? `The user is currently viewing: ${pageCtx.title ?? pageCtx.pathname} (${pageCtx.pathname}). ${pageCtx.summary ?? ""}`.trim()
          : "";
        const system = [
          role.systemPrompt,
          "\nThis is a fictional-data pilot. Never claim HIPAA, SOC 2, or regulatory compliance. Never invent operational metrics, savings, conflicts, schedules, or customer data.",
          ctxLine ? `\nPage context: ${ctxLine}` : "",
          body.memory ? `\nMemory: ${body.memory}` : "",
        ].join("");

        try {
          const provider = getProvider("lovable");
          return provider.streamResponse({ messages, system, tools: buildToolsForRole(role.tools) });
        } catch (error) {
          const msg = error instanceof Error ? error.message : "AI Employee unavailable";
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
