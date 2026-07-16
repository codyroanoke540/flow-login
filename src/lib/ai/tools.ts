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
 * All tools currently read from mock data. Replace the implementations with
 * real scheduling-engine calls as those services come online — the AI
 * contract does not need to change.
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
  const all: ToolSet = {
    get_schedule: tool({
      description: "Read today's or a given day's schedule from the scheduling engine.",
      inputSchema: z.object({
        date: z.string().describe("YYYY-MM-DD; omit for today").optional(),
      }),
      execute: async ({ date }) => level1({
        date: date ?? "today",
        summary: "38 employees active, 127 open appointments, 4 conflicts detected.",
        source: "scheduling-engine (mock)",
      }),
    }),
    detect_conflicts: tool({
      description: "List overlapping or infeasible appointments detected by the scheduling engine.",
      inputSchema: z.object({}),
      execute: async () => level1({
        conflicts: [
          { id: "c1", who: "Marcus L.", when: "Tue 2:00–3:30pm", reason: "Overlap with existing visit" },
          { id: "c2", who: "Priya R.", when: "Tue 4:00pm", reason: "Travel time infeasible from prior visit" },
        ],
      }),
    }),
    suggest_schedule_change: tool({
      description: "Propose a schedule change. Returns a proposal that must be approved by the user before it is applied.",
      inputSchema: z.object({
        summary: z.string().describe("What to change, in one sentence"),
        affected: z.array(z.string()).describe("Employees or clients affected"),
      }),
      execute: async ({ summary, affected }) => proposal(2, { summary, affected }, {
        reasoning: "Balances workload and removes detected conflict.",
        expectedOutcome: "Conflict cleared; utilization more even across the team.",
        impact: "Improves schedule health and reduces overtime risk.",
        timeSaved: "~45 minutes",
        costSaved: "$180",
        confidence: 88,
        alternatives: ["Keep the current assignment", "Reassign to a different employee with lower workload"],
      }),
    }),
    optimize_route: tool({
      description: "Propose a route optimization for a given day. Requires approval before executing.",
      inputSchema: z.object({
        date: z.string().optional(),
        region: z.string().optional(),
      }),
      execute: async ({ date, region }) => proposal(2, { date: date ?? "today", region: region ?? "all" }, {
        reasoning: "Consolidates overlapping loops in the same ZIP cluster.",
        expectedOutcome: "Fewer miles driven, less idle travel time.",
        impact: "Lower fuel + labor cost, on-time performance up.",
        timeSaved: "~1.2 hours",
        costSaved: "$74",
        confidence: 92,
        alternatives: ["Optimize only afternoon block", "Keep current route"],
      }),
    }),
    draft_message: tool({
      description: "Draft an email or SMS. Returns a draft for the user to review and send.",
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
        reasoning: "Prepared a concise, on-brand draft based on your stated purpose.",
        expectedOutcome: "Recipient understands the update and next step.",
        impact: "Faster response, fewer follow-ups.",
        confidence: 90,
        alternatives: ["Shorten to 2 sentences", "Add a scheduling link"],
      }),
    }),
    generate_report: tool({
      description: "Generate a report or summary from operational data.",
      inputSchema: z.object({
        topic: z.string().describe("e.g. 'weekly utilization', 'overtime this week'"),
      }),
      execute: async ({ topic }) => level1({
        topic,
        summary: `Report for ${topic}: 92 schedule-health score, $3,410 AI-driven savings this week, overtime down 26 hours vs last week.`,
      }),
    }),
    // Level 3 tools intentionally reject direct execution — they must be
    // driven through an approved proposal in the UI.
    modify_schedule: tool({
      description: "Apply an approved schedule change. Requires explicit user approval in the UI first.",
      inputSchema: z.object({ proposalId: z.string(), approved: z.boolean() }),
      execute: async ({ approved }) => approved
        ? { level: 3 as const, applied: true, source: "scheduling-engine (mock)" }
        : { level: 3 as const, requiresApproval: true, error: "Not approved" },
    }),
    cancel_appointment: tool({
      description: "Cancel an appointment. Requires explicit approval.",
      inputSchema: z.object({ appointmentId: z.string(), approved: z.boolean() }),
      execute: async ({ approved }) => approved
        ? { level: 3 as const, cancelled: true }
        : { level: 3 as const, requiresApproval: true, error: "Not approved" },
    }),
    notify_clients: tool({
      description: "Send notifications to clients. Requires explicit approval.",
      inputSchema: z.object({ audience: z.string(), approved: z.boolean() }),
      execute: async ({ approved }) => approved
        ? { level: 3 as const, notified: true }
        : { level: 3 as const, requiresApproval: true, error: "Not approved" },
    }),
    run_payroll: tool({
      description: "Trigger a payroll run. Requires explicit approval.",
      inputSchema: z.object({ period: z.string(), approved: z.boolean() }),
      execute: async ({ approved }) => approved
        ? { level: 3 as const, started: true }
        : { level: 3 as const, requiresApproval: true, error: "Not approved" },
    }),
  };

  const filtered: ToolSet = {};
  for (const name of allowed) if (all[name]) filtered[name] = all[name];
  return filtered;
}