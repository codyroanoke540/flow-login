import { createFileRoute } from "@tanstack/react-router";
import type { ModelMessage } from "ai";

import { getProvider } from "@/lib/ai/providers";
import { AI_ROLES, DEFAULT_ROLE, type AiRoleId } from "@/lib/ai/roles";
import { buildToolsForRole } from "@/lib/ai/tools";

type Body = {
  messages?: ModelMessage[];
  role?: AiRoleId;
  pageContext?: {
    pathname?: string;
    title?: string;
    summary?: string;
  };
  memory?: string;
};

export const Route = createFileRoute("/api/ai-employee")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const messages = Array.isArray(body.messages) ? body.messages : [];
        if (messages.length === 0) {
          return new Response("messages required", { status: 400 });
        }

        const role = AI_ROLES[body.role ?? DEFAULT_ROLE] ?? AI_ROLES[DEFAULT_ROLE];
        const pageCtx = body.pageContext ?? {};
        const ctxLine = pageCtx.pathname
          ? `The user is currently viewing: ${pageCtx.title ?? pageCtx.pathname} (${pageCtx.pathname}). ${pageCtx.summary ?? ""}`.trim()
          : "";

        const system = [
          role.systemPrompt,
          ctxLine ? `\nPage context: ${ctxLine}` : "",
          body.memory ? `\nMemory: ${body.memory}` : "",
        ].join("");

        try {
          const provider = getProvider("lovable");
          return provider.streamResponse({
            messages,
            system,
            tools: buildToolsForRole(role.tools),
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : "AI Employee unavailable";
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});