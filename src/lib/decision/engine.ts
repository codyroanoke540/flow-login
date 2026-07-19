import {
  DEFAULT_WEIGHTS,
  type Availability,
  type Account,
  type DecisionConstraint,
  type RecommendationDTO,
  type Resource,
  type ResourceLoad,
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

// ---- Hard constraint checks -----------------------------------------------

function hasSkills(resource: Resource, required: string[]): boolean {
  if (!required.length) return true;
  const set = new Set(resource.skills.map((s) => s.toLowerCase()));
  return required.every((s) => set.has(s.toLowerCase()));
}

function isAvailable(
  resource: Resource,
  workItem: WorkItem,
  availability: Availability[],
): boolean {
  if (!workItem.scheduled_start) return true;
  const start = new Date(workItem.scheduled_start);
  const weekday = start.getDay();
  const mins = start.getHours() * 60 + start.getMinutes();
  const slots = availability.filter((a) => a.resource_id === resource.id && a.weekday === weekday);
  if (!slots.length) return true; // no availability recorded = assume available
  return slots.some((slot) => {
    const [sh, sm] = slot.start_time.split(":").map(Number);
    const [eh, em] = slot.end_time.split(":").map(Number);
    const s = sh * 60 + sm;
    const e = eh * 60 + em;
    return mins >= s && mins + workItem.duration_minutes <= e;
  });
}

function checkHardConstraints(
  resource: Resource,
  workItem: WorkItem,
  constraints: DecisionConstraint[],
): string[] {
  const fails: string[] = [];
  for (const c of constraints.filter((x) => x.type === "hard" && x.active)) {
    const rule = c.rule_definition as { forbid_resource_ids?: string[]; require_status?: string };
    if (rule.forbid_resource_ids?.includes(resource.id)) fails.push(`Blocked by constraint "${c.name}"`);
    if (rule.require_status && resource.status !== rule.require_status) fails.push(`Constraint "${c.name}" requires status ${rule.require_status}`);
  }
  if (resource.status !== "active") fails.push("Resource is not active");
  void workItem;
  return fails;
}

// ---- Score factors (each returns 0..1) ------------------------------------

function skillMatchScore(resource: Resource, workItem: WorkItem): number {
  if (!workItem.required_skills.length) return 1;
  const set = new Set(resource.skills.map((s) => s.toLowerCase()));
  const matched = workItem.required_skills.filter((s) => set.has(s.toLowerCase())).length;
  return matched / workItem.required_skills.length;
}

function availabilityScore(resource: Resource, workItem: WorkItem, availability: Availability[]): number {
  return isAvailable(resource, workItem, availability) ? 1 : 0.3;
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
  // lower cost = better
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
  const capacityMins = Math.max(1, resource.capacity * 60);
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
  constraints: DecisionConstraint[];
  load: ResourceLoad[];
  weights: ScoreWeights;
}): ScoredCandidate[] {
  const { workItem, account, resources, availability, constraints, load, weights } = input;
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;

  return resources.map((resource) => {
    const disqualifiers = checkHardConstraints(resource, workItem, constraints);
    if (!hasSkills(resource, workItem.required_skills)) disqualifiers.push("Missing required skills");

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
  constraints: DecisionConstraint[];
  load: ResourceLoad[];
  approvalLevel?: 0 | 1 | 2;
}): { dto: RecommendationDTO; scored: ScoredCandidate[] } {
  const weights = resolveWeights(input.account, input.workItem);
  const scored = scoreCandidates({ ...input, weights });
  const valid = scored
    .filter((s) => s.score !== null)
    .sort((a, b) => (b.score! - a.score!)) as (ScoredCandidate & { score: number })[];

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
    : `No eligible resource. Disqualifiers: ${uniqueDisqualifiers(scored).join("; ") || "unspecified"}.`;

  const impactRisk: "low" | "medium" | "high" =
    !winner ? "high" : winner.score >= 75 ? "low" : winner.score >= 55 ? "medium" : "high";

  const alternatives = valid.slice(1, 4).map((s) => ({
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
  if (winner && winner.factors.availability < 1) risks.push(`Availability for ${winner.resource.name} is uncertain for this time window.`);
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
      cost: winner ? `~$${Math.round(winner.resource.cost_rate * (input.workItem.duration_minutes / 60))} labor` : "n/a",
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
  return Array.from(new Set(scored.flatMap((s) => s.disqualifiers)));
}