import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runPipeline } from "@/lib/decision/engine";
import type {
  Account,
  Availability,
  DecisionConstraint,
  RecommendationDTO,
  Resource,
  ResourceLoad,
  WorkItem,
} from "@/lib/decision/types";

/**
 * Cadence data + decision RPC surface. All calls run under the signed-in
 * user (RLS scopes rows by org_id = auth.uid()).
 */

// ---------- Resources -----------------------------------------------------

export const listResources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("resources")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const upsertResourceInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  type: z.string().default("employee"),
  skills: z.array(z.string()).default([]),
  location_id: z.string().uuid().nullable().optional(),
  capacity: z.number().default(40),
  cost_rate: z.number().default(0),
  status: z.string().default("active"),
});

export const upsertResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertResourceInput.parse(input))
  .handler(async ({ data, context }) => {
    const row = { ...data, org_id: context.userId };
    const { data: saved, error } = await context.supabase
      .from("resources")
      .upsert(row)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return saved;
  });

const availabilityInput = z.object({
  resource_id: z.string().uuid(),
  slots: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      start_time: z.string(),
      end_time: z.string(),
    }),
  ),
});

export const setAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => availabilityInput.parse(input))
  .handler(async ({ data, context }) => {
    await context.supabase.from("resource_availability").delete().eq("resource_id", data.resource_id);
    if (data.slots.length) {
      const rows = data.slots.map((s) => ({ ...s, resource_id: data.resource_id, org_id: context.userId }));
      const { error } = await context.supabase.from("resource_availability").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------- Accounts ------------------------------------------------------

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("accounts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const upsertAccountInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  type: z.string().default("customer"),
  tier: z.string().default("standard"),
  location_id: z.string().uuid().nullable().optional(),
  preferences: z.record(z.string(), z.unknown()).default({}),
  status: z.string().default("active"),
});

export const upsertAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertAccountInput.parse(input))
  .handler(async ({ data, context }) => {
    const row = { ...data, org_id: context.userId };
    const { data: saved, error } = await context.supabase
      .from("accounts")
      .upsert(row as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return saved;
  });

// ---------- Work items ----------------------------------------------------

export const listWorkItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("work_items")
      .select("*")
      .order("scheduled_start", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const createWorkItemInput = z.object({
  title: z.string().min(1),
  type: z.string().default("appointment"),
  account_id: z.string().uuid().nullable().optional(),
  required_skills: z.array(z.string()).default([]),
  duration_minutes: z.number().int().positive().default(60),
  priority: z.number().int().min(1).max(5).default(3),
  deadline: z.string().nullable().optional(),
  scheduled_start: z.string().nullable().optional(),
  location_id: z.string().uuid().nullable().optional(),
});

export const createWorkItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createWorkItemInput.parse(input))
  .handler(async ({ data, context }) => {
    const row = { ...data, org_id: context.userId, status: "pending" as const };
    const { data: saved, error } = await context.supabase
      .from("work_items")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return saved;
  });

// ---------- Decision pipeline --------------------------------------------

async function loadPipelineContext(supabase: any, userId: string, workItemId: string) {
  const [workItemRes, resourcesRes, availabilityRes, constraintsRes, loadRes] = await Promise.all([
    supabase.from("work_items").select("*").eq("id", workItemId).eq("org_id", userId).single(),
    supabase.from("resources").select("*").eq("org_id", userId),
    supabase.from("resource_availability").select("*").eq("org_id", userId),
    supabase.from("decision_constraints").select("*").eq("org_id", userId).eq("active", true),
    supabase.from("work_items").select("assigned_resource_id, duration_minutes").eq("org_id", userId).not("assigned_resource_id", "is", null),
  ]);

  if (workItemRes.error) throw new Error(workItemRes.error.message);
  const workItem = workItemRes.data as WorkItem;

  let account: Account | null = null;
  if (workItem.account_id) {
    const { data } = await supabase.from("accounts").select("*").eq("id", workItem.account_id).single();
    account = (data as Account) ?? null;
  }

  const load: ResourceLoad[] = [];
  for (const row of (loadRes.data ?? []) as Array<{ assigned_resource_id: string; duration_minutes: number }>) {
    const found = load.find((l) => l.resource_id === row.assigned_resource_id);
    if (found) found.minutes_scheduled += row.duration_minutes;
    else load.push({ resource_id: row.assigned_resource_id, minutes_scheduled: row.duration_minutes });
  }

  return {
    workItem,
    account,
    resources: (resourcesRes.data ?? []) as Resource[],
    availability: (availabilityRes.data ?? []) as Availability[],
    constraints: (constraintsRes.data ?? []) as DecisionConstraint[],
    load,
  };
}

const runRecommendationInput = z.object({ work_item_id: z.string().uuid(), trigger: z.string().optional() });

export const runRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => runRecommendationInput.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = await loadPipelineContext(context.supabase, context.userId, data.work_item_id);
    const { dto } = runPipeline({
      trigger: data.trigger ?? "Manual: recommend best resource",
      ...ctx,
      approvalLevel: 2,
    });

    const { data: saved, error } = await context.supabase
      .from("recommendations")
      .insert({
        org_id: context.userId,
        work_item_id: ctx.workItem.id,
        trigger: dto.trigger,
        context: dto.context as never,
        options: dto.alternatives as never,
        selected_option: dto.recommendation as never,
        reasoning: { text: dto.recommendation.reasoning },
        confidence_score: dto.recommendation.confidence,
        impact_assessment: dto.impact as never,
        risks: dto.risks as never,
        alternatives: dto.alternatives as never,
        approval_level: dto.approval_level,
        status: "pending",
      } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { recommendation: saved, dto: dto as unknown as Record<string, unknown> };
  });

export const listRecommendations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("recommendations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const decisionInput = z.object({ id: z.string().uuid() });

export const approveRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => decisionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rec, error: rerr } = await context.supabase
      .from("recommendations").select("*").eq("id", data.id).single();
    if (rerr || !rec) throw new Error(rerr?.message ?? "Not found");

    const selected = rec.selected_option as RecommendationDTO["recommendation"];
    if (selected?.resource_id && rec.work_item_id) {
      const { error: uerr } = await context.supabase
        .from("work_items")
        .update({ assigned_resource_id: selected.resource_id, status: "scheduled" })
        .eq("id", rec.work_item_id);
      if (uerr) throw new Error(uerr.message);
    }

    const { error: eerr } = await context.supabase
      .from("recommendations").update({ status: "executed" }).eq("id", rec.id);
    if (eerr) throw new Error(eerr.message);

    await context.supabase.from("outcomes").insert({
      org_id: context.userId,
      recommendation_id: rec.id,
      work_item_id: rec.work_item_id,
      expected_result: rec.impact_assessment,
      actual_result: { applied: true },
      variance: {},
    });

    return { ok: true };
  });

export const rejectRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => decisionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("recommendations").update({ status: "rejected" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });