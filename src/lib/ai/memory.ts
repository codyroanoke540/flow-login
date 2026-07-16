/**
 * Lightweight AI Employee memory. Stored in localStorage today; the same
 * interface will back onto the database when persistent memory ships. Call
 * sites don't need to change.
 */

export type AiMemory = {
  preferences: Record<string, string>; // e.g. { "prefers_low_overtime": "true" }
  frequentlyApproved: string[];
  businessRules: string[];
  recentTurns: { role: "user" | "assistant"; content: string }[];
};

const KEY = "cadence.ai-employee.memory.v1";

const empty: AiMemory = { preferences: {}, frequentlyApproved: [], businessRules: [], recentTurns: [] };

export function loadMemory(): AiMemory {
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty;
    return { ...empty, ...(JSON.parse(raw) as Partial<AiMemory>) };
  } catch {
    return empty;
  }
}

export function saveMemory(next: AiMemory) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota errors */
  }
}

export function rememberTurn(role: "user" | "assistant", content: string, limit = 20) {
  const mem = loadMemory();
  const recentTurns = [...mem.recentTurns, { role, content }].slice(-limit);
  saveMemory({ ...mem, recentTurns });
}

export function memorySummary(): string {
  const mem = loadMemory();
  const prefs = Object.entries(mem.preferences)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  const rules = mem.businessRules.slice(0, 5).join("; ");
  return [
    prefs ? `Preferences: ${prefs}.` : "",
    rules ? `Business rules: ${rules}.` : "",
  ].filter(Boolean).join(" ") || "No stored preferences yet.";
}