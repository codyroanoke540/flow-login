// Mock data used across the authenticated app until real data wiring lands.

export type KpiTrend = "up" | "down" | "flat";

export type Kpi = {
  label: string;
  value: string;
  delta: string;
  trend: KpiTrend;
  hint?: string;
};

export const kpis: Kpi[] = [
  { label: "Employees working today", value: "38", delta: "+3 vs yesterday", trend: "up" },
  { label: "Open appointments", value: "127", delta: "-6 vs yesterday", trend: "down" },
  { label: "Schedule health score", value: "92", delta: "+4 pts this week", trend: "up", hint: "Composite health of all schedules." },
  { label: "Travel efficiency", value: "88%", delta: "+2.1%", trend: "up" },
  { label: "Labor cost (today)", value: "$14,280", delta: "-$620 vs plan", trend: "down" },
  { label: "Customer satisfaction", value: "4.82", delta: "+0.06 this month", trend: "up" },
  { label: "AI confidence", value: "94%", delta: "Stable", trend: "flat" },
];

export type BriefingHighlight = {
  label: string;
  value: string;
  tone: "info" | "warn" | "success";
};

export const briefing: BriefingHighlight[] = [
  { label: "Scheduling conflicts detected", value: "4", tone: "warn" },
  { label: "Employees unavailable today", value: "2", tone: "warn" },
  { label: "Estimated labor savings", value: "$1,240", tone: "success" },
  { label: "Travel time reduced", value: "3.4 hrs", tone: "success" },
  { label: "Revenue opportunities", value: "6", tone: "info" },
  { label: "Overtime warnings", value: "3", tone: "warn" },
  { label: "AI recommendations waiting", value: "9", tone: "info" },
];

export type Recommendation = {
  id: string;
  title: string;
  category: "Conflict" | "Overtime" | "Travel" | "Revenue" | "Staffing" | "Burnout" | "Cancellation risk";
  problem: string;
  reason: string;
  action: string;
  confidence: number;
  impact: string;
  whyItMatters?: string;
  savings?: string;
};

export const recommendations: Recommendation[] = [
  {
    id: "r1",
    title: "Rebalance Tuesday afternoon route in North district",
    category: "Travel",
    problem: "3 employees are driving overlapping loops between 1–5pm.",
    reason: "Recent appointment additions clustered in the same ZIP made routes inefficient.",
    action: "Reassign 4 visits between Marcus and Priya to save 74 miles.",
    confidence: 96,
    impact: "$310 fuel + 2.6 hrs saved",
    whyItMatters: "Travel is your second-largest variable cost after labor. Small route inefficiencies compound weekly.",
    savings: "$310 / week",
  },
  {
    id: "r2",
    title: "Cancellation risk: Jordan Miles (Thu 3:00pm)",
    category: "Cancellation risk",
    problem: "Customer has cancelled 2 of the last 4 Thursday visits.",
    reason: "Pattern flagged by cancellation model + no confirmation reply.",
    action: "Send proactive confirmation + offer 4:30pm alternate.",
    confidence: 82,
    impact: "$180 revenue protected",
    whyItMatters: "Preventing a cancellation is 6x cheaper than filling the empty slot last-minute.",
    savings: "$180 protected",
  },
  {
    id: "r3",
    title: "Overtime warning: Sarah Chen (48h projected)",
    category: "Overtime",
    problem: "Sarah is projected to hit 48 scheduled hours this week.",
    reason: "Two double-books on Wed + Fri after last-minute additions.",
    action: "Move Fri 2pm visit to Devon (available, certified).",
    confidence: 91,
    impact: "$220 OT avoided",
    whyItMatters: "Overtime this week signals a scheduling pattern that will repeat next week if unaddressed.",
    savings: "$220 OT",
  },
  {
    id: "r4",
    title: "Open shift: Friday morning, South district",
    category: "Staffing",
    problem: "No coverage for a recurring 8am visit.",
    reason: "Assigned employee is on approved PTO Friday.",
    action: "Offer to Priya (top match, 97% skill fit).",
    confidence: 97,
    impact: "Prevents 1 missed visit",
    whyItMatters: "A missed recurring visit is the single strongest predictor of customer churn in the next 30 days.",
    savings: "$260 revenue",
  },
  {
    id: "r5",
    title: "Revenue opportunity: 3 customers eligible for expanded service",
    category: "Revenue",
    problem: "Utilization + satisfaction thresholds passed.",
    reason: "Model identifies customers likely to accept an additional weekly visit.",
    action: "Draft outreach for account owners.",
    confidence: 74,
    impact: "$4,200 MRR potential",
    whyItMatters: "Expansion revenue from existing customers has a 4x higher close rate than new acquisition.",
    savings: "$4,200 MRR",
  },
  {
    id: "r6",
    title: "Burnout signal: Marcus Lee",
    category: "Burnout",
    problem: "6 consecutive on-call days + declining satisfaction scores.",
    reason: "Rolling workload index in top decile.",
    action: "Distribute next week's on-call across 3 employees.",
    confidence: 68,
    impact: "Retention risk mitigated",
    whyItMatters: "Replacing a trained field employee costs 1.5–2x their annual salary in ramp and lost productivity.",
    savings: "Retention",
  },
];

export type Employee = {
  id: string;
  name: string;
  initials: string;
  role: string;
  status: "Available" | "Working" | "Off";
  skills: string[];
  certifications: string[];
  location: string;
  workload: number; // 0..100
  nextAppointment?: string;
};

export const employees: Employee[] = [
  { id: "e1", name: "Sarah Chen", initials: "SC", role: "Senior Field Lead", status: "Working", skills: ["Assessments", "Onboarding"], certifications: ["BCBA", "CPR"], location: "North District", workload: 82, nextAppointment: "Today 2:00pm — Miles residence" },
  { id: "e2", name: "Marcus Lee", initials: "ML", role: "Field Specialist", status: "Working", skills: ["Home visits", "Bilingual (ES)"], certifications: ["RBT"], location: "North District", workload: 74, nextAppointment: "Today 3:30pm — Alvarez residence" },
  { id: "e3", name: "Priya Patel", initials: "PP", role: "Field Specialist", status: "Available", skills: ["Home visits", "New hire mentor"], certifications: ["RBT", "First Aid"], location: "South District", workload: 41, nextAppointment: "Tomorrow 9:00am — Nguyen residence" },
  { id: "e4", name: "Devon Brooks", initials: "DB", role: "Senior Specialist", status: "Available", skills: ["Complex cases"], certifications: ["BCBA"], location: "East District", workload: 55, nextAppointment: "Tomorrow 8:00am — Rivera residence" },
  { id: "e5", name: "Alex Rivera", initials: "AR", role: "Field Specialist", status: "Off", skills: ["Assessments"], certifications: ["RBT"], location: "West District", workload: 0 },
  { id: "e6", name: "Jamie Wu", initials: "JW", role: "Scheduling Coordinator", status: "Working", skills: ["Ops", "Dispatch"], certifications: [], location: "HQ", workload: 63 },
];

export type Customer = {
  id: string;
  name: string;
  contact: string;
  location: string;
  tags: string[];
  lastAppointment: string;
  ltv: string;
  status: "Active" | "Paused" | "Onboarding";
};

export const customers: Customer[] = [
  { id: "c1", name: "Miles Household", contact: "Jordan Miles", location: "North District", tags: ["Weekly", "Priority"], lastAppointment: "Jul 10", ltv: "$18,240", status: "Active" },
  { id: "c2", name: "Alvarez Household", contact: "Carla Alvarez", location: "North District", tags: ["Bi-weekly"], lastAppointment: "Jul 09", ltv: "$9,820", status: "Active" },
  { id: "c3", name: "Nguyen Household", contact: "Linh Nguyen", location: "South District", tags: ["Weekly"], lastAppointment: "Jul 08", ltv: "$12,410", status: "Active" },
  { id: "c4", name: "Rivera Household", contact: "Sam Rivera", location: "East District", tags: ["New"], lastAppointment: "Jul 05", ltv: "$1,240", status: "Onboarding" },
  { id: "c5", name: "Kim Household", contact: "Grace Kim", location: "West District", tags: ["Paused"], lastAppointment: "Jun 22", ltv: "$14,900", status: "Paused" },
  { id: "c6", name: "Okafor Household", contact: "Chidi Okafor", location: "South District", tags: ["Weekly", "High-value"], lastAppointment: "Jul 11", ltv: "$26,110", status: "Active" },
];

export type Appointment = {
  id: string;
  time: string; // e.g. "09:00"
  duration: number; // hours
  day: number; // 0..6 (Mon..Sun)
  customer: string;
  employee: string;
  category: "visit" | "assessment" | "followup";
  aiSuggested?: boolean;
};

export const appointments: Appointment[] = [
  { id: "a1", time: "08:00", duration: 1.5, day: 0, customer: "Miles Household", employee: "Sarah Chen", category: "visit" },
  { id: "a2", time: "10:30", duration: 1, day: 0, customer: "Alvarez Household", employee: "Marcus Lee", category: "visit" },
  { id: "a3", time: "13:00", duration: 2, day: 1, customer: "Nguyen Household", employee: "Priya Patel", category: "assessment", aiSuggested: true },
  { id: "a4", time: "09:00", duration: 1, day: 2, customer: "Rivera Household", employee: "Devon Brooks", category: "visit" },
  { id: "a5", time: "15:00", duration: 1, day: 2, customer: "Okafor Household", employee: "Sarah Chen", category: "followup" },
  { id: "a6", time: "11:00", duration: 1.5, day: 3, customer: "Miles Household", employee: "Marcus Lee", category: "visit", aiSuggested: true },
  { id: "a7", time: "08:30", duration: 1, day: 4, customer: "Kim Household", employee: "Priya Patel", category: "visit" },
  { id: "a8", time: "14:00", duration: 2, day: 4, customer: "Okafor Household", employee: "Devon Brooks", category: "assessment" },
];

export type Automation = {
  id: string;
  name: string;
  when: string;
  then: string;
  enabled: boolean;
};

export const automations: Automation[] = [
  { id: "au1", name: "Call-out coverage", when: "An employee calls out", then: "Recommend qualified replacements ranked by fit", enabled: true },
  { id: "au2", name: "Cancellation escalation", when: "An appointment is cancelled", then: "Notify scheduler + suggest a fill", enabled: true },
  { id: "au3", name: "Overtime guardrail", when: "Projected overtime exceeds 5 hrs / employee / week", then: "Alert manager with rebalancing options", enabled: true },
  { id: "au4", name: "New customer onboarding", when: "A new customer is created", then: "Auto-schedule intake + assign owner", enabled: false },
];

export const integrations = [
  { id: "int-gcal", name: "Google Calendar", desc: "Two-way sync for employee calendars.", status: "Not connected" as const },
  { id: "int-slack", name: "Slack", desc: "Deliver AI recommendations to a channel.", status: "Not connected" as const },
  { id: "int-qbo", name: "QuickBooks", desc: "Push labor + revenue data for payroll and books.", status: "Not connected" as const },
  { id: "int-twilio", name: "Twilio", desc: "SMS confirmations + reminders.", status: "Not connected" as const },
  { id: "int-zapier", name: "Zapier", desc: "Trigger workflows in 6,000+ apps.", status: "Not connected" as const },
  { id: "int-hubspot", name: "HubSpot", desc: "Sync customers and pipeline.", status: "Not connected" as const },
];

// Analytics series
export const laborUtilization = [
  { week: "W1", value: 71 },
  { week: "W2", value: 74 },
  { week: "W3", value: 78 },
  { week: "W4", value: 82 },
  { week: "W5", value: 84 },
  { week: "W6", value: 88 },
];

export const revenueSeries = [
  { week: "W1", revenue: 82000 },
  { week: "W2", revenue: 86500 },
  { week: "W3", revenue: 91000 },
  { week: "W4", revenue: 94200 },
  { week: "W5", revenue: 97800 },
  { week: "W6", revenue: 102400 },
];

export const completionSeries = [
  { week: "W1", completed: 92, missed: 8 },
  { week: "W2", completed: 93, missed: 7 },
  { week: "W3", completed: 95, missed: 5 },
  { week: "W4", completed: 96, missed: 4 },
  { week: "W5", completed: 97, missed: 3 },
  { week: "W6", completed: 97, missed: 3 },
];

export type HealthScore = {
  label: string;
  score: number; // 0..100
  delta: string;
  hint: string;
};

export const healthScores: HealthScore[] = [
  { label: "Schedule health", score: 92, delta: "+4 pts", hint: "Coverage, conflicts, and buffer time." },
  { label: "Employee utilization", score: 84, delta: "+3 pts", hint: "Billable time vs. capacity." },
  { label: "Operational efficiency", score: 88, delta: "+2 pts", hint: "Composite of travel, labor, and completion." },
  { label: "Customer coverage", score: 96, delta: "Stable", hint: "% of contracted visits scheduled." },
  { label: "Travel optimization", score: 88, delta: "+2 pts", hint: "Actual miles vs. optimal routing." },
  { label: "Labor efficiency", score: 81, delta: "+5 pts", hint: "Labor spend vs. revenue produced." },
];

export const laborCostSeries = [
  { week: "W1", planned: 68000, actual: 70200 },
  { week: "W2", planned: 69000, actual: 68400 },
  { week: "W3", planned: 70000, actual: 68900 },
  { week: "W4", planned: 71000, actual: 69100 },
  { week: "W5", planned: 72000, actual: 69800 },
  { week: "W6", planned: 73000, actual: 70400 },
];

export const travelSeries = [
  { week: "W1", miles: 4200 },
  { week: "W2", miles: 4050 },
  { week: "W3", miles: 3880 },
  { week: "W4", miles: 3720 },
  { week: "W5", miles: 3610 },
  { week: "W6", miles: 3440 },
];

export const overtimeSeries = [
  { week: "W1", hours: 48 },
  { week: "W2", hours: 41 },
  { week: "W3", hours: 36 },
  { week: "W4", hours: 31 },
  { week: "W5", hours: 26 },
  { week: "W6", hours: 22 },
];

export const aiSavingsSeries = [
  { week: "W1", savings: 1800 },
  { week: "W2", savings: 2350 },
  { week: "W3", savings: 2740 },
  { week: "W4", savings: 2980 },
  { week: "W5", savings: 3220 },
  { week: "W6", savings: 3410 },
];

export type TodaySignal = {
  id: string;
  label: string;
  count: number;
  tone: "info" | "warn" | "critical" | "success";
  hint: string;
  ask: string;
};

export const todaySignals: TodaySignal[] = [
  { id: "conflicts", label: "Scheduling conflicts", count: 4, tone: "warn", hint: "Overlaps and infeasible travel windows", ask: "Show me the conflicts and propose fixes." },
  { id: "late", label: "Employees running late", count: 2, tone: "warn", hint: "ETA slipping vs planned start", ask: "Which visits are at risk and who can cover?" },
  { id: "reassign", label: "Clients needing reassignment", count: 3, tone: "critical", hint: "Assigned employee unavailable", ask: "Reassign these clients and draft the notifications." },
  { id: "docs", label: "Documentation missing", count: 7, tone: "warn", hint: "Session notes overdue > 24h", ask: "Summarize missing docs and message the owners." },
  { id: "payroll", label: "Payroll warnings", count: 2, tone: "warn", hint: "Overtime + missing punches", ask: "Explain the payroll warnings and how to resolve them." },
  { id: "cancel", label: "Upcoming cancellations", count: 5, tone: "info", hint: "Predicted cancels in next 24h", ask: "Show cancellations at highest risk and mitigation options." },
  { id: "weather", label: "Weather-affected visits", count: 6, tone: "info", hint: "Storm forecast in North district", ask: "Which visits should we reschedule for weather?" },
  { id: "travel", label: "Travel optimization opps", count: 4, tone: "success", hint: "Route consolidations available", ask: "Optimize routes for tomorrow." },
  { id: "productivity", label: "Today's productivity", count: 92, tone: "success", hint: "Schedule-health composite", ask: "Summarize today's productivity for the manager." },
  { id: "approvals", label: "Alerts needing approval", count: 3, tone: "critical", hint: "Level 3 actions awaiting confirmation", ask: "List the pending approvals with reasoning." },
];