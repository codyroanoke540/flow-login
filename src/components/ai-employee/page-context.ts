/**
 * Human-readable summaries for each authenticated page so the AI Employee
 * knows what the user is currently looking at.
 */

export type PageContext = {
  pathname: string;
  title: string;
  summary: string;
  prompts: string[];
};

export function describePage(pathname: string): PageContext {
  if (pathname.startsWith("/operations")) return {
    pathname,
    title: "Operations Center",
    summary: "Live AI operations feed, health scores, and analytics preview.",
    prompts: [
      "What's the biggest risk in today's schedule?",
      "Reduce total driving time tomorrow.",
      "Draft the morning briefing for the team.",
    ],
  };
  if (pathname.startsWith("/schedule")) return {
    pathname,
    title: "Schedule",
    summary: "Day/week schedule view backed by the scheduling engine.",
    prompts: [
      "Who is overloaded tomorrow?",
      "Find someone to cover Sarah's appointments.",
      "Show me today's highest-risk clients.",
    ],
  };
  if (pathname.startsWith("/employees")) return {
    pathname,
    title: "Employees",
    summary: "Employee roster, skills, availability, and workload.",
    prompts: [
      "Who is at risk of burnout this week?",
      "Which employees are underutilized?",
      "Draft a message to the on-call team.",
    ],
  };
  if (pathname.startsWith("/customers")) return {
    pathname,
    title: "Customers",
    summary: "Customer directory and lifetime value.",
    prompts: [
      "Which customers are highest LTV?",
      "Any customers at churn risk?",
      "Draft a reassignment email to a client.",
    ],
  };
  if (pathname.startsWith("/analytics")) return {
    pathname,
    title: "Analytics",
    summary: "Trends in labor, travel, revenue, completion, and AI savings.",
    prompts: [
      "How can I improve utilization this week?",
      "Explain the drop in travel miles.",
      "Summarize weekly performance.",
    ],
  };
  if (pathname.startsWith("/automations")) return {
    pathname,
    title: "Automations",
    summary: "When/then rules for common operational events.",
    prompts: [
      "Suggest a new automation for cancellations.",
      "Which automations should I turn off?",
    ],
  };
  if (pathname.startsWith("/ai")) return {
    pathname,
    title: "AI Command Center",
    summary: "Pending AI recommendations.",
    prompts: [
      "Explain the top recommendation.",
      "Prioritize the recommendations by impact.",
    ],
  };
  if (pathname.startsWith("/integrations")) return {
    pathname,
    title: "Integrations",
    summary: "Connected services.",
    prompts: ["Which integrations should I connect first?"],
  };
  if (pathname.startsWith("/settings")) return {
    pathname,
    title: "Settings",
    summary: "Organization and workspace settings.",
    prompts: ["Help me configure notification preferences."],
  };
  if (pathname.startsWith("/dashboard")) return {
    pathname,
    title: "Executive Dashboard",
    summary: "AI briefing and business health signals.",
    prompts: [
      "Give me the morning briefing.",
      "What needs a decision today?",
      "Create tomorrow's schedule.",
    ],
  };
  return {
    pathname,
    title: "Cadence",
    summary: "AI Operations Platform.",
    prompts: [
      "Give me the morning briefing.",
      "Show today's highest-risk items.",
      "Draft an email explaining schedule changes.",
    ],
  };
}