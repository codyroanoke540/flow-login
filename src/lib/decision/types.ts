/**
 * Cadence decision-engine domain types. These mirror the DB rows we care
 * about plus derived DTOs used by the pipeline. They are pure data — no
 * I/O — so the engine can be unit-tested in isolation.
 */

export type ID = string;

export interface Resource {
  id: ID;
  name: string;
  type: string;
  skills: string[];
  location_id: ID | null;
  capacity: number;
  cost_rate: number;
  status: string;
  metadata: Record<string, unknown>;
}

export interface Availability {
  resource_id: ID;
  weekday: number; // 0-6
  start_time: string; // HH:MM
  end_time: string; // HH:MM
}

export interface Account {
  id: ID;
  name: string;
  tier: string;
  preferences: { weights?: Partial<ScoreWeights>; preferred_resource_ids?: ID[] } & Record<string, unknown>;
  location_id: ID | null;
}

export interface WorkItem {
  id: ID;
  title: string;
  account_id: ID | null;
  required_skills: string[];
  duration_minutes: number;
  priority: number; // 1 (low) - 5 (critical)
  deadline: string | null;
  scheduled_start: string | null;
  location_id: ID | null;
  status: string;
  assigned_resource_id: ID | null;
  metadata: { weights?: Partial<ScoreWeights> } & Record<string, unknown>;
}

export interface DecisionConstraint {
  id: ID;
  name: string;
  type: "hard" | "soft";
  scope: string;
  rule_definition: Record<string, unknown>;
  active: boolean;
}

export interface ResourceLoad {
  resource_id: ID;
  minutes_scheduled: number;
}

export type ScoreFactor =
  | "skill_match"
  | "availability"
  | "proximity"
  | "cost_efficiency"
  | "priority_alignment"
  | "historical_performance"
  | "workload_balance";

export type ScoreWeights = Record<ScoreFactor, number>;

export const DEFAULT_WEIGHTS: ScoreWeights = {
  skill_match: 1.0,
  availability: 0.9,
  proximity: 0.7,
  cost_efficiency: 0.6,
  priority_alignment: 0.5,
  historical_performance: 0.4,
  workload_balance: 0.6,
};

export interface ScoredCandidate {
  resource: Resource;
  score: number | null; // null = hard-constraint disqualified
  factors: Record<ScoreFactor, number>;
  disqualifiers: string[];
  notes: string[];
}

export interface RecommendationDTO {
  trigger: string;
  context: {
    work_item: WorkItem;
    available_resources: Array<Pick<Resource, "id" | "name" | "skills">>;
    active_constraints: Array<Pick<DecisionConstraint, "id" | "name" | "type">>;
    relevant_history: unknown[];
  };
  recommendation: {
    action: string;
    resource_id: ID | null;
    reasoning: string;
    confidence: number;
    confidence_explanation: string;
  };
  impact: {
    cost: string;
    time: string;
    risk_level: "low" | "medium" | "high";
    affected_accounts: ID[];
  };
  alternatives: Array<{
    option: string;
    resource_id: ID;
    score: number;
    why_not_selected: string;
  }>;
  risks: string[];
  approval_level: 0 | 1 | 2 | 3 | 4;
  status: "pending" | "approved" | "rejected" | "executed";
}