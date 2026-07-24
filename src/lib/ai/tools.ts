import { tool, type ToolSet } from "ai";
import { z } from "zod";

import type { PermissionLevel } from "./permissions";

/**
 * Tool registry for AI Employees.
 *
 * - Level 1 tools execute immediately (read-only).
 * - Level 2/3 tools return a proposal payload; the client renders an
 *   approval card and re-invokes with `approved: true` to actually run.
 *
 * Operational read/write tools remain disabled until they are connected to
 * authenticated Cadence server functions. Disabled tools return an honest
 * unavailable response and never fabricate schedules, conflicts, or savings.
 */

export type ToolDescriptor = {
  name: string;
  level: PermissionLevel;
  description: string;
};

export const TOOL_CATALOG: ToolDescriptor[] = [
  { name: "get_schedule", level: 1, description: "Read today's or this week's schedule." },
  { name: "detect_conflicts", level: 1, description: "Find overlapping or infeasible appointments." },
  { name: "suggest_schedule_change", level: 2, description: "Propose a schedule change for approval." },
  { name: "optimize_route", level: 2, description: "Propose a route optimization for approval." },
  { name: "draft_message", level: 2, description: "Draft an email or SMS for review." },
  { name: "generate_report", level: 1, description: "Generate a report or summary." },
  { name: "modify_schedule", level: 3, description: "Apply an approved schedule change." },
  { name: "cancel_appointment", level: 3, description: "Cancel an appointment." },
  { name: "notify_clients", level: 3, description: "Send notifications to clients." },
  { name: "run_payroll", level: 3, description: "Trigger a payroll run." },
];

function level1<T>(data: T) {
  return { level: 1 as const, data };
}

function proposal<T>(level: 2 | 3, data: T, explain: {
  reasoning: string; expectedOutcome: string; impact: string;
  timeSaved?: string; costSaved?: string; confidence: number; alternatives?: string[];
}) {
  return { level, requiresApproval: true, data, explain };
}

/** Build the AI SDK ToolSet the model is allowed to call for a given role. */
export function buildToolsForRole(allowed: string[]): ToolSet {
  const unavailable = (capability: string) => ({
    available: false as const,
    capability,
    message: `${capability} is not connected to live Cadence data yet. Use the Schedule and Operations Center for verified information.`,
  });

  const all: ToolSet = {
    get_schedule: tool({
      description: "Read a schedule when live schedule-tool access is enabled.",
      inputSchema: z.object({ date: z.string().optional() }),
      execute: async () => level1(unavailable("Schedule access")),
    }),
    detect_conflicts: tool({
      description: "Detect conflicts when live decision-engine tool access is enabled.",
      inputSchema: z.object({}),
      execute: async () => level1(unavailable("Conflict detection")),
    }),
    suggest_schedule_change: tool({
      description: "Propose a schedule change when authenticated scheduling tools are enabled.",
      inputSchema: z.object({ summary: z.string(), affected: z.array(z.string()) }),
      execute: async () => unavailable("Schedule-change proposals"),
    }),
    optimize_route: tool({
      description: "Optimize routes when live location and travel data are enabled.",
      inputSchema: z.object({ date: z.string().optional(), region: z.string().optional() }),
      execute: async () => unavailable("Route optimization"),
    }),
    draft_message: tool({
      description: "Draft an email or SMS for the user to review. This does not send anything.",
      inputSchema: z.object({
        channel: z.enum(["email", "sms"]),
        to: z.string().describe("Recipient name or role"),
        purpose: z.string().describe("What the message should accomplish"),
      }),
      execute: async ({ channel, to, purpose }) => proposal(2, {
        channel,
        to,
        subject: channel === "email" ? "Update from your team" : undefined,
        body: `Hi ${to},\n\n${purpose}\n\nThanks,\nThe Cadence team`,
      }, {
        reasoning: "Drafted from the user's instructions only; no message has been sent.",
        expectedOutcome: "A reviewable communication draft.",
        impact: "No operational change until a user reviews and sends it outside this tool.",
        confidence: 70,
        alternatives: ["Make the tone more concise", "Add specific dates and next steps"],
      }),
    }),
    generate_report: tool({
      description: "Generate reports when authenticated operational reporting is enabled.",
      inputSchema: z.object({ topic: z.string() }),
      execute: async () => level1(unavailable("Operational reporting")),
    }),
    modify_schedule: tool({
      description: "Apply a schedule change when authenticated write tools are enabled.",
      inputSchema: z.object({ proposalId: z.string(), approved: z.boolean() }),
      execute: async () => unavailable("Schedule modification"),
    }),
    cancel_appointment: tool({
      description: "Cancel an appointment when authenticated write tools are enabled.",
      inputSchema: z.object({ appointmentId: z.string(), approved: z.boolean() }),
      execute: async () => unavailable("Appointment cancellation"),
    }),
    notify_clients: tool({
      description: "Notify clients when an approved messaging integration is enabled.",
      inputSchema: z.object({ audience: z.string(), approved: z.boolean() }),
      execute: async () => unavailable("Client notification"),
    }),
    run_payroll: tool({
      description: "Run payroll when an approved payroll integration is enabled.",
      inputSchema: z.object({ period: z.string(), approved: z.boolean() }),
      execute: async () => unavailable("Payroll execution"),
    }),
  };

  const filtered: ToolSet = {};
  for (const name of allowed) if (all[name]) filtered[name] = all[name];
  return filtered;
}
