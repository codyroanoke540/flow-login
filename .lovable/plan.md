## Cadence Decision Platform — Build Plan

Build the four-layer decision architecture on top of the existing Cadence shell (auth, sidebar, AI panel, mock data). Preserve current design; no visual redesign. Everything below reuses existing routes, tokens, and components — we only add data models, a decision engine, and wire two screens to real data.

---

### Phase 1 — Core data layer (universal objects)

Single migration adds tables + RLS + GRANTs, scoped by `org_id` (the signed-in user is the org for MVP):

- `locations` (id, org_id, name, address, timezone, region, metadata)
- `resources` (id, org_id, name, type, skills[], location_id, capacity, cost_rate, status, metadata)
- `resource_availability` (id, resource_id, weekday, start_time, end_time)
- `accounts` (id, org_id, name, type, tier, requirements, preferences, location_id, status)
- `work_items` (id, org_id, title, type, account_id, required_skills[], duration_minutes, priority, deadline, location_id, status, assigned_resource_id)
- `requirements` (id, work_item_id, type hard|soft, description, value, weight)
- `constraints` (id, org_id, name, type hard|soft, scope, rule_definition jsonb, active)
- `policies` (id, org_id, name, industry, scope, rules jsonb, version, active)
- `objectives` (id, org_id, name, type maximize|minimize|balance, metric, weight, scope)
- `recommendations` (id, org_id, trigger, context jsonb, options jsonb, selected_option jsonb, reasoning jsonb, confidence_score, impact_assessment jsonb, risks jsonb, alternatives jsonb, approval_level, status, created_at)
- `outcomes` (id, recommendation_id, work_item_id, actual_result jsonb, expected_result jsonb, variance jsonb, recorded_at)

RLS: each table `USING (org_id = auth.uid())` for authenticated. GRANTs to authenticated + service_role in the same migration. Standard `updated_at` trigger.

Seed data stays in migration (deterministic demo rows for the signed-in user's first login is out of scope; empty states shown instead).

---

### Phase 2 — Decision engine (server-side, pure functions)

`src/lib/decision/` — no I/O, unit-testable:

- `types.ts` — TS types mirroring the DB models + `Candidate`, `ScoredCandidate`, `Recommendation` DTO matching the spec's JSON exactly.
- `constraints.ts` — `applyHardConstraints(candidates, workItem, constraints)` filters.
- `scoring.ts` — factor functions (skill_match, availability, proximity, cost_efficiency, priority_alignment, historical_performance, workload_balance). Weights resolved via `resolveWeights(global → industry → account → workItem)`.
- `optimize.ts` — weighted sum, normalize 0–100, tie-break by objectives.
- `confidence.ts` — spread between top candidates + data completeness → 0–100 + explanation string.
- `explain.ts` — builds the reasoning/impact/alternatives payload.
- `pipeline.ts` — orchestrates the 13 stages, returns a full `Recommendation` object matching the spec.

---

### Phase 3 — Server functions (RPC surface)

`src/lib/*.functions.ts` under `requireSupabaseAuth`:

- Resources: `listResources`, `upsertResource`, `setAvailability`
- Accounts: `listAccounts`, `upsertAccount`
- WorkItems: `listWorkItems`, `createWorkItem`, `assignWorkItem`
- Constraints/Policies/Objectives: `list*` + `upsert*`
- Decisions: `runRecommendation(workItemId)` → persists a `recommendations` row + returns it; `approveRecommendation(id)` (Class 2) executes the assignment and writes an `outcomes` row; `rejectRecommendation(id)`.

Class 0/1/2 supported; Class 3/4 fields exist in the schema but are rejected at the server boundary for MVP.

---

### Phase 4 — Wire existing UI to real data (no redesign)

Only screens already in the sidebar. Replace mock-data imports with `useSuspenseQuery` against the new server fns:

- `/employees` → resources (list, add, edit availability)
- `/customers` → accounts (list, add)
- `/schedule` → work items list + assign action
- `/operations` → live `recommendations` feed; each card renders the spec's fields (what/why, confidence + explanation, impact, alternatives, risks). Approve/Reject calls the server fns.
- `/dashboard` → counts + last 5 recommendations.

Other routes (Analytics, Automations, Integrations, AI, Settings) keep current mock UI — untouched.

---

### Phase 5 — AI panel integration

The existing `/api/ai-employee` streaming route gains one server-side tool: `run_recommendation(workItemId)` that calls the pipeline and returns the recommendation payload. The panel already renders tool proposals — no UI change needed.

---

### Out of scope for this build

- Class 3/4 autonomy, learning loop beyond storing outcomes, industry-module packaging UI, audit-log viewer, multi-user orgs, real geocoding (proximity uses stored lat/lng if present, else neutral score), payroll/notifications tools.

### Technical notes

- All new tables carry `org_id uuid not null` = `auth.uid()` on insert. RLS `USING (org_id = auth.uid())`.
- Recommendation JSON columns are `jsonb`; the DTO shape returned to the client matches the spec verbatim so the UI is a direct render.
- Scoring weights: default row in `objectives` per org on first write; per-account/work-item overrides via `preferences.weights` / `metadata.weights` merged in `resolveWeights`.
- No changes to auth, routing shell, styles, or the AI provider layer.

Approve to start with the Phase 1 migration.
