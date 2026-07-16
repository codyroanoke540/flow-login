/**
 * Every AI Employee action is classified into one of three permission levels.
 * The scheduling engine is the source of truth — the AI never writes directly.
 */

export type PermissionLevel = 1 | 2 | 3;

export const PERMISSION_META: Record<PermissionLevel, { label: string; description: string }> = {
  1: {
    label: "Read-only",
    description: "Answers questions, summarizes, or explains. No approval required.",
  },
  2: {
    label: "Suggested action",
    description: "Drafts changes and recommendations. User must approve before execution.",
  },
  3: {
    label: "Business-critical",
    description: "Schedule writes, cancellations, payroll, notifications. Always requires explicit approval.",
  },
};

export type Explainable<T = unknown> = {
  data: T;
  explain: {
    reasoning: string;
    expectedOutcome: string;
    impact: string;
    timeSaved?: string;
    costSaved?: string;
    confidence: number; // 0-100
    alternatives?: string[];
  };
};