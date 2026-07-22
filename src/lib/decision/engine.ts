import {
  DEFAULT_WEIGHTS,
  type Availability,
  type Account,
  type DecisionConstraint,
  type DisqualificationReason,
  type RecommendationDTO,
  type Resource,
  type ResourceQualification,
  type ResourceLoad,
  type AssignedWindow,
  type TimeOff,
  type ScoreFactor,
  type ScoreWeights,
  type ScoredCandidate,
  type WorkItem,
} from "./types";

/**
 * Weight resolution: Global -> Industry -> Account -> WorkItem.
 * Later entries override earlier ones for any factor they set.
 */
export function resolveWeights(
  account?: Account | null,
  workItem?: WorkItem | null,
): ScoreWeights {
  return {
    ...DEFAULT_WEIGHTS,
    ...(account?.preferences?.weights ?? {}),
    ...(workItem?.metadata?.weights ?? {}),
  };
}

// ---- Hard constraint checks (deterministic) --------------------------------

function windowOf(workItem: WorkItem): { start: Date; end: Date } | null {
  if (!workItem.scheduled_start) return null;
  const start = new Date(workItem.scheduled_start);
  const end = workItem.scheduled_end
    ? new Date(workItem.scheduled_end)
    : new Date(start.getTime() + (workItem.duration_minutes || 60) * 60_000);
  return { start, end };
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

function checkAvailabilityFit(
  resource: Resource,
  workItem: WorkItem,
  availability: Availability[],
): DisqualificationReason | null {
  const w = windowOf(workItem);
  if (!w) return null; // no scheduled window means we can't rule out by availability
  const anyForResource = availability.some((a) => a.resource_id === resource.id);
  if (!anyForResource) {
    return { code: "unavailable", detail: "Weekly availability has not been configured" };
  }
  const slots = availability.filter((a) => a.resource_id === resource.id && a.weekday === w.start.getDay());
  if (!slots.length) {
    const dayName = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][w.start.getDay()];
    return { code: "unavailable", detail: `Not available on ${dayName}` };
  }
  const startMins = w.start.getHours() * 60 + w.start.getMinutes();
  const endMins = w.end.getHours() * 60 + w.end.getMinutes();
  const covers = slots.some((slot) => {
    const [sh, sm] = slot.start_time.split(":").map(Number);
    const [eh, em] = slot.end_time.split(":").map(Number);
    return startMins >= sh * 60 + sm && endMins <= eh * 60 + em;
  });
  return covers
    ? null
    : { code: "unavailable", detail: "Weekly availability does not cover the requested time window" };
}

function checkTimeOff(resource: Resource, workItem: WorkItem, timeOff: TimeOff[]): DisqualificationReason | null {
  const w = windowOf(workItem);
  if (!w) return null;
  const conflict = timeOff.find(
    (t) =>
      t.resource_id === resource.id &&
      t.status === "approved" &&
      overlaps(w.start, w.end, new Date(t.starts_at), new Date(t.ends_at)),
  );
  return conflict ? { code: "time_off", detail: "On approved time off during this window" } : null;
}

function checkOverlap(
  resource: Resource,
  workItem: WorkItem,
  assignments: AssignedWindow[],
): DisqualificationReason | null {
  const w = windowOf(workItem);
  if (!w) return null;
  const conflict = assignments.find(
    (a) =>
      a.resource_id === resource.id &&
      a.work_item_id !== workItem.id &&
      overlaps(w.start, w.end, new Date(a.scheduled_start), new Date(a.scheduled_end)),
  );
  return conflict
    ? { code: "overlap", detail: "Already assigned to another work item that overlaps this window" }
    : null;
}

function checkSkills(resource: Resource, workItem: WorkItem): DisqualificationReason | null {
  if (!workItem.required_skills?.length) return null;
  const set = new Set(resource.skills.map((s) => s.toLowerCase()));
  const missing = workItem.required_skills.filter((s) => !set.has(s.toLowerCase()));
  return missing.length
    ? { code: "missing_skill", detail: `Missing required skill${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}` }
    : null;
}

function checkQualifications(
  resource: Resource,
  workItem: WorkItem,
  quals: ResourceQualification[],
): DisqualificationReason | null {
  const required = workItem.required_qualifications ?? [];
  if (!required.length) return null;
  const w = windowOf(workItem);
  const asOf = w?.start ?? new Date();
  const held = quals.filter((q) => q.resource_id === resource.id);
  const codes = new Set(held.map((q) => q.qualification_code.toLowerCase()));
  for (const req of required) {
    if (!codes.has(req.toLowerCase())) {
      return { code: "missing_qualification", detail: `Missing required qualification: ${req}` };
    }
    const match = held.find((q) => q.qualification_code.toLowerCase() === req.toLowerCase())!;
    if (match.expires_on && new Date(match.expires_on) < asOf) {
      return { code: "expired_qualification", detail: `Qualification ${req} expired on ${match.expires_on}` };
    }
  }
  return null;
}

function checkCapacity(
  resource: Resource,
  workItem: WorkItem,
  load: ResourceLoad[],
): DisqualificationReason | null {
  const weeklyMinutes = Math.max(0, (resource.weekly_capacity_hours ?? resource.capacity ?? 40) * 60);
  if (!weeklyMinutes) return null;
  const current = load.find((l) => l.resource_id === resource.id)?.minutes_scheduled ?? 0;
  const projected = current + (workItem.duration_minutes || 60);
  return projected > weeklyMinutes
    ? {
        code: "capacity_exceeded",
        detail: `Would exceed weekly capacity (${Math.round(projected / 60)}h > ${Math.round(weeklyMinutes / 60)}h)`,
      }
    : null;
}

function checkConstraints(
  resource: Resource,
  workItem: WorkItem,
  constraints: DecisionConstraint[],
): DisqualificationReason[] {
  const out: DisqualificationReason[] = [];
  for (const c of constraints.filter((x) => x.type === "hard" && x.active)) {
    const rule = c.rule_definition as { forbid_resource_ids?: string[]; require_status?: string };
    if (rule.forbid_resource_ids?.includes(resource.id)) {
      out.push({ code: "constraint", detail: `Blocked by constraint "${c.name}"` });
    }
    if (rule.require_status && resource.status !== rule.require_status) {
      out.push({ code: "constraint", detail: `Constraint "${c.name}" requires status ${rule.require_status}` });
    }
  }
  void workItem;
  return out;
}

function evaluateDisqualifiers(input: {
  resource: Resource;
  workItem: WorkItem;
  availability: Availability[];
  quals: ResourceQualification[];
  timeOff: TimeOff[];
  assignments: AssignedWindow[];
  constraints: DecisionConstraint[];
  load: ResourceLoad[];
}): DisqualificationReason[] {
  const reasons: DisqualificationReason[] = [];
  if (input.resource.status !== "active") reasons.push({ code: "inactive", detail: "Resource is not active" });
  const s = checkSkills(input.resource, input.workItem);
  if (s) reasons.push(s);
  const q = checkQualifications(input.resource, input.workItem, input.quals);
  if (q) reasons.push(q);
  const t = checkTimeOff(input.resource, input.workItem, input.timeOff);
  if (t) reasons.push(t);
  const o = checkOverlap(input.resource, input.workItem, input.assignments);
  if (o) reasons.push(o);
  const a = checkAvailabilityFit(input.resource, input.workItem, input.availability);
  if (a) reasons.push(a);
  const cap = checkCapacity(input.resource, input.workItem, input.load);
  if (cap) reasons.push(cap);
  reasons.push(...checkConstraints(input.resource, input.workItem, input.constraints));
  return reasons;
}

// ---- Score factors (each returns 0..1) ------------------------------------

function skillMatchScore(resource: Resource, workItem: WorkItem): number {
  if (!workItem.required_skills.length) return 1;
  const set = new Set(resource.skills.map((s) => s.toLowerCase()));
  const matched = workItem.required_skills.filter((s) => set.has(s.toLowerCase())).length;
  return matched / workItem.required_skills.length;
}

function availabilityScore(resource: Resource, workItem: WorkItem, availability: Availability[]): number {
  const w = windowOf(workItem);
  if (!w) return 0.9;
  const slots = availability.filter((a) => a.resource_id === resource.id && a.weekday === w.start.getDay());
  if (!slots.length) return 0;
  return 1;
}

function proximityScore(resource: Resource, workItem: WorkItem): number {
  if (!workItem.location_id) return 0.75;
  return resource.location_id === workItem.location_id ? 1 : 0.5;
}

function costEfficiencyScore(resource: Resource, allResources: Resource[]): number {
  const rates = allResources.map((r) => r.cost_rate).filter((r) => r > 0);
  if (!rates.length) return 0.75;
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  if (max === min) return 1;
  return 1 - (resource.cost_rate - min) / (max - min);
}

function priorityAlignmentScore(resource: Resource, workItem: WorkItem, account: Account | null): number {
  if (workItem.priority >= 4 && account?.preferences?.preferred_resource_ids?.includes(resource.id)) return 1;
  if (workItem.priority >= 4) return 0.6;
  return 0.8;
}

function historicalPerformanceScore(resource: Resource): number {
  const perf = Number((resource.metadata as { performance?: number })?.performance ?? 0.75);
  return Math.max(0, Math.min(1, perf));
}

function workloadBalanceScore(resource: Resource, load: ResourceLoad[], workItem: WorkItem): number {
  const capacityMins = Math.max(1, (resource.weekly_capacity_hours ?? resource.capacity ?? 40) * 60);
  const current = load.find((l) => l.resource_id === resource.id)?.minutes_scheduled ?? 0;
  const projected = (current + workItem.duration_minutes) / capacityMins;
  return Math.max(0, 1 - projected);
}

// ---- Scoring & selection --------------------------------------------------

export function scoreCandidates(input: {
  workItem: WorkItem;
  account: Account | null;
  resources: Resource[];
  availability: Availability[];
  quals: ResourceQualification[];
  timeOff: TimeOff[];
  assignments: AssignedWindow[];
  constraints: DecisionConstraint[];
  load: ResourceLoad[];
  weights: ScoreWeights;
}): ScoredCandidate[] {
  const { workItem, account, resources, availability, quals, timeOff, assignments, constraints, load, weights } = input;
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;

  return resources.map((resource) => {
    const disqualifiers = evaluateDisqualifiers({
      resource, workItem, availability, quals, timeOff, assignments, constraints, load,
    });

    const factors: Record<ScoreFactor, number> = {
      skill_match: skillMatchScore(resource, workItem),
      availability: availabilityScore(resource, workItem, availability),
      proximity: proximityScore(resource, workItem),
      cost_efficiency: costEfficiencyScore(resource, resources),
      priority_alignment: priorityAlignmentScore(resource, workItem, account),
      historical_performance: historicalPerformanceScore(resource),
      workload_balance: workloadBalanceScore(resource, load, workItem),
    };

    if (disqualifiers.length) {
      return { resource, score: null, factors, disqualifiers, notes: [] };
    }

    const weighted =
      Object.entries(factors).reduce((sum, [k, v]) => sum + v * (weights[k as ScoreFactor] ?? 0), 0) /
      totalWeight;
    const score = Math.round(weighted * 100);
    return { resource, score, factors, disqualifiers, notes: [] };
  });
}

// ---- Confidence -----------------------------------------------------------

function calcConfidence(scored: ScoredCandidate[]): { value: number; explanation: string } {
  const valid = scored.filter((s) => s.score !== null) as (ScoredCandidate & { score: number })[];
  if (!valid.length) return { value: 0, explanation: "No eligible resources." };
  valid.sort((a, b) => b.score - a.score);
  const top = valid[0].score;
  const runner = valid[1]?.score ?? 0;
  const gap = top - runner;
  const base = top; // top score already 0..100
  const spreadBoost = Math.min(20, gap); // clear winner boosts confidence
  const value = Math.max(0, Math.min(100, Math.round(base * 0.85 + spreadBoost)));
  const explanation = valid.length === 1
    ? `Only one eligible resource passed all hard constraints.`
    : `Top candidate scored ${top}, next best ${runner} (gap ${gap}). Confidence weighted by top score and margin.`;
  return { value, explanation };
}

// ---- Full pipeline --------------------------------------------------------

export function runPipeline(input: {
  trigger: string;
  workItem: WorkItem;
  account: Account | null;
  resources: Resource[];
  availability: Availability[];
  quals: ResourceQualification[];
  timeOff: TimeOff[];
  assignments: AssignedWindow[];
  constraints: DecisionConstraint[];
  load: ResourceLoad[];
  approvalLevel?: 0 | 1 | 2;
}): { dto: RecommendationDTO; scored: ScoredCandidate[] } {
  const weights = resolveWeights(input.account, input.workItem);
  const scored = scoreCandidates({ ...input, weights });
  const valid = scored
    .filter((s) => s.score !== null)
    .sort((a, b) => (b.score! - a.score!)) as (ScoredCandidate & { score: number })[];

  valid.forEach((c, i) => { c.rank = i + 1; c.explanation = `Rank ${i + 1}: ${topFactorSummary(c)}.`; });
  const disqualified = scored.filter((s) => s.score === null);
  disqualified.forEach((c) => { c.explanation = c.disqualifiers.map((d) => d.detail).join("; "); });

  const winner = valid[0] ?? null;
  const confidence = calcConfidence(scored);

  const reasoning = winner
    ? [
        `Considered ${scored.length} resources; ${valid.length} passed hard constraints.`,
        `Top score ${winner.score}/100 driven by ${topFactorSummary(winner)}.`,
        winner.factors.workload_balance < 0.5
          ? `Note: ${winner.resource.name} will approach capacity after this assignment.`
          : `${winner.resource.name} has spare capacity for this assignment.`,
      ].join(" ")
    : `No eligible resource. Reasons: ${uniqueDisqualifiers(scored).join("; ") || "unspecified"}.`;

  const impactRisk: "low" | "medium" | "high" =
    !winner ? "high" : winner.score >= 75 ? "low" : winner.score >= 55 ? "medium" : "high";

  const alternatives = valid.slice(1, 6).map((s) => ({
    option: `Assign to ${s.resource.name}`,
    resource_id: s.resource.id,
    score: s.score,
    why_not_selected:
      winner && s.score < winner.score
        ? `Scored ${s.score} vs ${winner.score}; weaker on ${weakestFactor(s)}.`
        : "Tied score, but ranked lower after tie-break.",
  }));

  const risks: string[] = [];
  if (!winner) risks.push("No candidate meets hard constraints — the request will not be schedulable as-is.");
  if (winner && winner.factors.workload_balance < 0.4) risks.push(`${winner.resource.name} is near capacity and may trigger overtime.`);
  if (winner && winner.factors.availability < 1) risks.push(`Availability data for ${winner.resource.name} is incomplete — confirm before assigning.`);
  if (winner && winner.factors.skill_match < 1) risks.push(`Partial skill match — ${winner.resource.name} may need support on this task.`);

  const dto: RecommendationDTO = {
    trigger: input.trigger,
    context: {
      work_item: input.workItem,
      available_resources: input.resources.map((r) => ({ id: r.id, name: r.name, skills: r.skills })),
      active_constraints: input.constraints.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name, type: c.type })),
      relevant_history: [],
    },
    recommendation: {
      action: winner
        ? `Assign "${input.workItem.title}" to ${winner.resource.name}`
        : `Cannot assign "${input.workItem.title}" — no eligible resource.`,
      resource_id: winner?.resource.id ?? null,
      reasoning,
      confidence: confidence.value,
      confidence_explanation: confidence.explanation,
    },
    impact: {
      cost: winner && winner.resource.cost_rate > 0
        ? `~$${Math.round(winner.resource.cost_rate * (input.workItem.duration_minutes / 60))} labor`
        : "Cost rate not set",
      time: `${input.workItem.duration_minutes} min`,
      risk_level: impactRisk,
      affected_accounts: input.workItem.account_id ? [input.workItem.account_id] : [],
    },
    alternatives,
    risks,
    approval_level: input.approvalLevel ?? 2,
    status: "pending",
  };

  return { dto, scored };
}

function topFactorSummary(s: ScoredCandidate): string {
  const entries = Object.entries(s.factors).sort((a, b) => b[1] - a[1]).slice(0, 2);
  return entries.map(([k, v]) => `${k.replace(/_/g, " ")} (${Math.round(v * 100)}%)`).join(" and ");
}

function weakestFactor(s: ScoredCandidate): string {
  const entry = Object.entries(s.factors).sort((a, b) => a[1] - b[1])[0];
  return entry ? entry[0].replace(/_/g, " ") : "overall fit";
}

function uniqueDisqualifiers(scored: ScoredCandidate[]): string[] {
  return Array.from(new Set(scored.flatMap((s) => s.disqualifiers.map((d) => d.detail))));
}
