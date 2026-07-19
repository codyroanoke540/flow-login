import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runPipeline } from "@/lib/decision/engine";
import type {
  Account,
  AssignedWindow,
  Availability,
  DecisionConstraint,
  RecommendationDTO,
  Resource,
  ResourceLoad,
  ResourceQualification,
  TimeOff,
  WorkItem,
} from "@/lib/decision/types";

/**
 * Cadence server-function surface. Runs under signed-in user; membership
 * RLS enforces tenant isolation. Every write resolves the active org via
 * `profiles.active_organization_id` (fallback: first active membership).
 */

type Ctx = { supabase: any; userId: string };

async function resolveActiveOrg(ctx: Ctx): Promise<string> {
  const { data: prof } = await ctx.supabase
    .from("profiles").select("active_organization_id").eq("id", ctx.userId).maybeSingle();
  if (prof?.active_organization_id) return prof.active_organization_id as string;
  const { data: mem } = await ctx.supabase
    .from("org_members").select("org_id").eq("user_id", ctx.userId).eq("status", "active").limit(1);
  const orgId = mem?.[0]?.org_id;
  if (!orgId) throw new Error("No active organization for this user.");
  await ctx.supabase.from("profiles").update({ active_organization_id: orgId }).eq("id", ctx.userId);
  return orgId as string;
}

async function getRole(ctx: Ctx, orgId: string): Promise<string | null> {
  const { data } = await ctx.supabase
    .from("org_members").select("role").eq("org_id", orgId).eq("user_id", ctx.userId).eq("status", "active").maybeSingle();
  return (data?.role as string) ?? null;
}

function assertRole(role: string | null, allowed: string[]): void {
  if (!role || !allowed.includes(role)) {
    throw new Error(`Not authorized: requires ${allowed.join(" or ")} (current: ${role ?? "none"})`);
  }
}

async function writeAudit(ctx: Ctx, orgId: string, event: {
  action: string;
  entity_type: string;
  entity_id?: string | null;
  previous_state?: unknown;
  new_state?: unknown;
  reason?: string;
  recommendation_id?: string | null;
  correlation_id?: string | null;
  source?: string;
  pipeline_version?: string;
}) {
  const role = await getRole(ctx, orgId);
  await ctx.supabase.from("audit_events").insert({
    org_id: orgId,
    actor_user_id: ctx.userId,
    actor_role: role,
    source: event.source ?? "app",
    ...event,
  });
}

// ---------- Session / Org --------------------------------------------------

export const getSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await resolveActiveOrg(context);
    const [profileRes, orgRes, memberships] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      context.supabase.from("organizations").select("*").eq("id", orgId).maybeSingle(),
      context.supabase
        .from("org_members")
        .select("id, org_id, role, status, organizations!inner(id, name)")
        .eq("user_id", context.userId).eq("status", "active"),
    ]);
    const { data: settings } = await context.supabase
      .from("organization_settings").select("*").eq("org_id", orgId).maybeSingle();
    const role = await getRole(context, orgId);
    return {
      user_id: context.userId,
      profile: profileRes.data,
      active_organization: orgRes.data,
      role,
      memberships: memberships.data ?? [],
      settings,
    };
  });

export const setActiveOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ org_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: mem } = await context.supabase
      .from("org_members").select("id").eq("org_id", data.org_id).eq("user_id", context.userId).eq("status", "active").maybeSingle();
    if (!mem) throw new Error("Not a member of that organization.");
    await context.supabase.from("profiles").update({ active_organization_id: data.org_id }).eq("id", context.userId);
    return { ok: true };
  });

export const updateOrgSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    industry: z.string().optional(),
    terminology: z.record(z.string(), z.string()).optional(),
    scoring_config: z.record(z.string(), z.unknown()).optional(),
    feature_flags: z.record(z.string(), z.unknown()).optional(),
    onboarding_completed: z.boolean().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    assertRole(await getRole(context, orgId), ["owner", "admin"]);
    const patch: Record<string, unknown> = { org_id: orgId };
    if (data.industry !== undefined) patch.industry = data.industry;
    if (data.terminology !== undefined) patch.terminology = data.terminology;
    if (data.scoring_config !== undefined) patch.scoring_config = data.scoring_config;
    if (data.feature_flags !== undefined) patch.feature_flags = data.feature_flags;
    if (data.onboarding_completed) patch.onboarding_completed_at = new Date().toISOString();
    const { data: saved, error } = await context.supabase
      .from("organization_settings").upsert(patch as never).select("*").single();
    if (error) throw new Error(error.message);
    await writeAudit(context, orgId, { action: "org_settings.updated", entity_type: "organization_settings", entity_id: orgId, new_state: saved });
    return saved;
  });

// ---------- Resources -----------------------------------------------------

export const listResources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await resolveActiveOrg(context);
    const { data, error } = await context.supabase
      .from("resources").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1),
    email: z.string().email().nullable().optional(),
    type: z.string().default("employee"),
    skills: z.array(z.string()).default([]),
    location_id: z.string().uuid().nullable().optional(),
    weekly_capacity_hours: z.number().default(40),
    cost_rate: z.number().default(0),
    status: z.string().default("active"),
    notes: z.string().nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager", "scheduler"]);
    const row: Record<string, unknown> = {
      org_id: orgId,
      name: data.name,
      email: data.email ?? null,
      type: data.type,
      skills: data.skills,
      location_id: data.location_id ?? null,
      capacity: data.weekly_capacity_hours,
      weekly_capacity_hours: data.weekly_capacity_hours,
      cost_rate: data.cost_rate,
      status: data.status,
      notes: data.notes ?? null,
    };
    if (data.id) row.id = data.id;
    const { data: saved, error } = await context.supabase
      .from("resources").upsert(row as never).select("*").single();
    if (error) throw new Error(error.message);
    await writeAudit(context, orgId, {
      action: data.id ? "resource.updated" : "resource.created",
      entity_type: "resource", entity_id: saved.id, new_state: saved,
    });
    return saved;
  });

export const setResourceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["active", "inactive"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager"]);
    const patch: Record<string, unknown> = { status: data.status };
    patch.deactivated_at = data.status === "inactive" ? new Date().toISOString() : null;
    const { data: saved, error } = await context.supabase
      .from("resources").update(patch as never).eq("id", data.id).eq("org_id", orgId).select("*").single();
    if (error) throw new Error(error.message);
    await writeAudit(context, orgId, { action: "resource.status_changed", entity_type: "resource", entity_id: data.id, new_state: { status: data.status } });
    return saved;
  });

export const setAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    resource_id: z.string().uuid(),
    slots: z.array(z.object({ weekday: z.number().int().min(0).max(6), start_time: z.string(), end_time: z.string() })),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    await context.supabase.from("resource_availability").delete().eq("resource_id", data.resource_id).eq("org_id", orgId);
    if (data.slots.length) {
      const rows = data.slots.map((s) => ({ ...s, resource_id: data.resource_id, org_id: orgId }));
      const { error } = await context.supabase.from("resource_availability").insert(rows);
      if (error) throw new Error(error.message);
    }
    await writeAudit(context, orgId, { action: "availability.updated", entity_type: "resource", entity_id: data.resource_id, new_state: { slots: data.slots } });
    return { ok: true };
  });

export const listAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await resolveActiveOrg(context);
    const { data } = await context.supabase.from("resource_availability").select("*").eq("org_id", orgId);
    return data ?? [];
  });

// ---------- Qualifications -------------------------------------------------

export const addResourceQualification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    resource_id: z.string().uuid(),
    qualification_code: z.string().min(1),
    issued_on: z.string().nullable().optional(),
    expires_on: z.string().nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    const { data: saved, error } = await context.supabase
      .from("resource_qualifications")
      .upsert({ org_id: orgId, ...data }, { onConflict: "resource_id,qualification_code" })
      .select("*").single();
    if (error) throw new Error(error.message);
    await writeAudit(context, orgId, { action: "qualification.updated", entity_type: "resource", entity_id: data.resource_id, new_state: saved });
    return saved;
  });

export const removeResourceQualification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    const { error } = await context.supabase.from("resource_qualifications").delete().eq("id", data.id).eq("org_id", orgId);
    if (error) throw new Error(error.message);
    await writeAudit(context, orgId, { action: "qualification.removed", entity_type: "resource_qualifications", entity_id: data.id });
    return { ok: true };
  });

export const listResourceQualifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await resolveActiveOrg(context);
    const { data } = await context.supabase.from("resource_qualifications").select("*").eq("org_id", orgId);
    return data ?? [];
  });

// ---------- Time off -------------------------------------------------------

export const createTimeOff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    resource_id: z.string().uuid(),
    starts_at: z.string(),
    ends_at: z.string(),
    reason: z.string().nullable().optional(),
    status: z.enum(["pending", "approved", "rejected", "canceled"]).default("approved"),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    const { data: saved, error } = await context.supabase
      .from("resource_time_off").insert({ org_id: orgId, ...data }).select("*").single();
    if (error) throw new Error(error.message);
    await writeAudit(context, orgId, { action: "time_off.created", entity_type: "resource_time_off", entity_id: saved.id, new_state: saved });
    return saved;
  });

export const deleteTimeOff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    const { error } = await context.supabase.from("resource_time_off").delete().eq("id", data.id).eq("org_id", orgId);
    if (error) throw new Error(error.message);
    await writeAudit(context, orgId, { action: "time_off.deleted", entity_type: "resource_time_off", entity_id: data.id });
    return { ok: true };
  });

export const listTimeOff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await resolveActiveOrg(context);
    const { data } = await context.supabase.from("resource_time_off").select("*").eq("org_id", orgId).order("starts_at");
    return data ?? [];
  });

// ---------- Accounts ------------------------------------------------------

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await resolveActiveOrg(context);
    const { data, error } = await context.supabase
      .from("accounts").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1),
    type: z.string().default("customer"),
    tier: z.string().default("standard"),
    location_id: z.string().uuid().nullable().optional(),
    contact_name: z.string().nullable().optional(),
    contact_email: z.string().nullable().optional(),
    contact_phone: z.string().nullable().optional(),
    required_skills: z.array(z.string()).default([]),
    default_duration_minutes: z.number().int().positive().default(60),
    notes: z.string().nullable().optional(),
    preferences: z.record(z.string(), z.unknown()).default({}),
    status: z.string().default("active"),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager", "scheduler"]);
    const row = { ...data, org_id: orgId } as never;
    const { data: saved, error } = await context.supabase
      .from("accounts").upsert(row).select("*").single();
    if (error) throw new Error(error.message);
    await writeAudit(context, orgId, {
      action: data.id ? "account.updated" : "account.created",
      entity_type: "account", entity_id: saved.id, new_state: saved,
    });
    return saved;
  });

// ---------- Work items ----------------------------------------------------

export const listWorkItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await resolveActiveOrg(context);
    const { data, error } = await context.supabase
      .from("work_items").select("*").eq("org_id", orgId)
      .order("scheduled_start", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createWorkItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    title: z.string().min(1),
    type: z.string().default("appointment"),
    account_id: z.string().uuid().nullable().optional(),
    required_skills: z.array(z.string()).default([]),
    required_qualifications: z.array(z.string()).default([]),
    duration_minutes: z.number().int().positive().default(60),
    priority: z.number().int().min(1).max(5).default(3),
    deadline: z.string().nullable().optional(),
    scheduled_start: z.string().nullable().optional(),
    scheduled_end: z.string().nullable().optional(),
    location_id: z.string().uuid().nullable().optional(),
    notes: z.string().nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager", "scheduler"]);
    let scheduled_end = data.scheduled_end;
    if (!scheduled_end && data.scheduled_start) {
      scheduled_end = new Date(new Date(data.scheduled_start).getTime() + data.duration_minutes * 60_000).toISOString();
    }
    const row = { ...data, scheduled_end, org_id: orgId, status: "unassigned" as const };
    const { data: saved, error } = await context.supabase
      .from("work_items").insert(row).select("*").single();
    if (error) throw new Error(error.message);
    await writeAudit(context, orgId, { action: "work_item.created", entity_type: "work_item", entity_id: saved.id, new_state: saved });
    return saved;
  });

export const updateWorkItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    title: z.string().optional(),
    scheduled_start: z.string().nullable().optional(),
    scheduled_end: z.string().nullable().optional(),
    duration_minutes: z.number().int().positive().optional(),
    required_skills: z.array(z.string()).optional(),
    required_qualifications: z.array(z.string()).optional(),
    priority: z.number().int().min(1).max(5).optional(),
    notes: z.string().nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager", "scheduler"]);
    const { id, ...patch } = data;
    const { data: saved, error } = await context.supabase
      .from("work_items").update(patch).eq("id", id).eq("org_id", orgId).select("*").single();
    if (error) throw new Error(error.message);
    await writeAudit(context, orgId, { action: "work_item.updated", entity_type: "work_item", entity_id: id, new_state: saved });
    return saved;
  });

export const cancelWorkItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), reason: z.string().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager", "scheduler"]);
    const { data: saved, error } = await context.supabase
      .from("work_items").update({ status: "canceled" }).eq("id", data.id).eq("org_id", orgId).select("*").single();
    if (error) throw new Error(error.message);
    await writeAudit(context, orgId, { action: "work_item.canceled", entity_type: "work_item", entity_id: data.id, reason: data.reason, new_state: saved });
    return saved;
  });

// ---------- Decision pipeline --------------------------------------------

async function loadPipelineContext(supabase: any, orgId: string, workItemId: string) {
  const [workItemRes, resourcesRes, availabilityRes, qualsRes, timeOffRes, constraintsRes, assignmentsRes] = await Promise.all([
    supabase.from("work_items").select("*").eq("id", workItemId).eq("org_id", orgId).single(),
    supabase.from("resources").select("*").eq("org_id", orgId),
    supabase.from("resource_availability").select("*").eq("org_id", orgId),
    supabase.from("resource_qualifications").select("*").eq("org_id", orgId),
    supabase.from("resource_time_off").select("*").eq("org_id", orgId).eq("status", "approved"),
    supabase.from("decision_constraints").select("*").eq("org_id", orgId).eq("active", true),
    supabase.from("work_items").select("id, assigned_resource_id, scheduled_start, scheduled_end, duration_minutes")
      .eq("org_id", orgId).not("assigned_resource_id", "is", null).neq("status", "canceled"),
  ]);

  if (workItemRes.error) throw new Error(workItemRes.error.message);
  const workItem = workItemRes.data as WorkItem;

  let account: Account | null = null;
  if (workItem.account_id) {
    const { data } = await supabase.from("accounts").select("*").eq("id", workItem.account_id).single();
    account = (data as Account) ?? null;
  }

  const assignments: AssignedWindow[] = ((assignmentsRes.data ?? []) as any[]).map((r) => {
    const start = r.scheduled_start ? new Date(r.scheduled_start).toISOString() : new Date().toISOString();
    const end = r.scheduled_end
      ? new Date(r.scheduled_end).toISOString()
      : new Date(new Date(start).getTime() + (r.duration_minutes || 60) * 60_000).toISOString();
    return { resource_id: r.assigned_resource_id, work_item_id: r.id, scheduled_start: start, scheduled_end: end };
  });

  const load: ResourceLoad[] = [];
  const now = workItem.scheduled_start ? new Date(workItem.scheduled_start) : new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);
  for (const a of assignments) {
    const s = new Date(a.scheduled_start);
    if (s >= weekStart && s < weekEnd) {
      const mins = (new Date(a.scheduled_end).getTime() - s.getTime()) / 60_000;
      const found = load.find((l) => l.resource_id === a.resource_id);
      if (found) found.minutes_scheduled += mins;
      else load.push({ resource_id: a.resource_id, minutes_scheduled: mins });
    }
  }

  return {
    workItem,
    account,
    resources: (resourcesRes.data ?? []) as Resource[],
    availability: (availabilityRes.data ?? []) as Availability[],
    quals: (qualsRes.data ?? []) as ResourceQualification[],
    timeOff: (timeOffRes.data ?? []) as TimeOff[],
    constraints: (constraintsRes.data ?? []) as DecisionConstraint[],
    assignments,
    load,
  };
}

export const runRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ work_item_id: z.string().uuid(), trigger: z.string().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager", "scheduler", "supervisor"]);
    const ctx = await loadPipelineContext(context.supabase, orgId, data.work_item_id);
    const { dto, scored } = runPipeline({
      trigger: data.trigger ?? "Manual: recommend best resource",
      ...ctx,
      approvalLevel: 2,
    });

    const { data: saved, error } = await context.supabase
      .from("recommendations").insert({
        org_id: orgId,
        work_item_id: ctx.workItem.id,
        trigger: dto.trigger,
        context: dto.context as never,
        options: dto.alternatives as never,
        selected_option: dto.recommendation as never,
        reasoning: { text: dto.recommendation.reasoning, confidence_explanation: dto.recommendation.confidence_explanation },
        confidence_score: dto.recommendation.confidence,
        impact_assessment: dto.impact as never,
        risks: dto.risks as never,
        alternatives: dto.alternatives as never,
        approval_level: dto.approval_level,
        status: "pending",
      } as never)
      .select("*").single();
    if (error) throw new Error(error.message);

    const candidateRows = scored
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
      .map((c, i) => ({
        org_id: orgId,
        recommendation_id: saved.id,
        resource_id: c.resource.id,
        resource_name: c.resource.name,
        eligible: c.score !== null,
        disqualification_reasons: c.disqualifiers as never,
        factor_scores: c.factors as never,
        weighted_score: c.score,
        rank: c.score !== null ? i + 1 : null,
        explanation: c.explanation ?? null,
      }));
    if (candidateRows.length) {
      await context.supabase.from("recommendation_candidates").insert(candidateRows);
    }

    await context.supabase.from("work_items")
      .update({ status: "pending_approval" })
      .eq("id", ctx.workItem.id).eq("org_id", orgId);

    await writeAudit(context, orgId, {
      action: "recommendation.generated",
      entity_type: "recommendation",
      entity_id: saved.id,
      recommendation_id: saved.id,
      new_state: { confidence: saved.confidence_score, action: dto.recommendation.action, candidate_count: candidateRows.length },
      pipeline_version: "v1",
    });

    return { recommendation: saved };
  });

export const listCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ recommendation_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    const { data: rows } = await context.supabase
      .from("recommendation_candidates").select("*")
      .eq("recommendation_id", data.recommendation_id).eq("org_id", orgId)
      .order("eligible", { ascending: false }).order("weighted_score", { ascending: false, nullsFirst: false });
    return rows ?? [];
  });

export const listRecommendations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await resolveActiveOrg(context);
    const { data, error } = await context.supabase
      .from("recommendations").select("*").eq("org_id", orgId)
      .order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const approveRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    const role = await getRole(context, orgId);
    assertRole(role, ["owner", "admin", "operations_manager", "scheduler", "supervisor"]);
    const { data: rec, error: rerr } = await context.supabase
      .from("recommendations").select("*").eq("id", data.id).eq("org_id", orgId).single();
    if (rerr || !rec) throw new Error(rerr?.message ?? "Not found");
    if (rec.status !== "pending") throw new Error(`Recommendation is already ${rec.status}`);

    const selected = rec.selected_option as RecommendationDTO["recommendation"];
    if (!selected?.resource_id || !rec.work_item_id) {
      throw new Error("Cannot approve: no resource selected in this recommendation.");
    }

    // Revalidate hard constraints server-side (idempotent + stale-safe)
    const ctx = await loadPipelineContext(context.supabase, orgId, rec.work_item_id);
    const { scored } = runPipeline({ trigger: "approval-recheck", ...ctx, approvalLevel: 2 });
    const chosen = scored.find((c) => c.resource.id === selected.resource_id);
    if (!chosen || chosen.score === null) {
      const reasons = chosen?.disqualifiers.map((d) => d.detail).join("; ") || "resource no longer eligible";
      throw new Error(`Cannot approve: ${reasons}`);
    }

    const { error: uerr } = await context.supabase
      .from("work_items")
      .update({ assigned_resource_id: selected.resource_id, status: "assigned" })
      .eq("id", rec.work_item_id).eq("org_id", orgId);
    if (uerr) throw new Error(uerr.message);

    const { error: eerr } = await context.supabase
      .from("recommendations").update({ status: "approved" }).eq("id", rec.id).eq("org_id", orgId);
    if (eerr) throw new Error(eerr.message);

    await context.supabase.from("approvals").insert({
      org_id: orgId,
      recommendation_id: rec.id,
      approver_user_id: context.userId,
      approver_role: role,
      status: "approved",
      approved_at: new Date().toISOString(),
    });

    await writeAudit(context, orgId, {
      action: "recommendation.approved",
      entity_type: "recommendation",
      entity_id: rec.id,
      recommendation_id: rec.id,
      new_state: { assigned_resource_id: selected.resource_id, work_item_id: rec.work_item_id },
    });
    await writeAudit(context, orgId, {
      action: "work_item.assigned",
      entity_type: "work_item",
      entity_id: rec.work_item_id,
      recommendation_id: rec.id,
      new_state: { assigned_resource_id: selected.resource_id },
    });

    return { ok: true };
  });

export const rejectRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), reason: z.string().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    const role = await getRole(context, orgId);
    assertRole(role, ["owner", "admin", "operations_manager", "scheduler", "supervisor"]);
    const { data: rec } = await context.supabase.from("recommendations").select("*").eq("id", data.id).eq("org_id", orgId).single();
    if (!rec) throw new Error("Not found");

    const { error } = await context.supabase
      .from("recommendations").update({ status: "rejected" }).eq("id", data.id).eq("org_id", orgId);
    if (error) throw new Error(error.message);

    if (rec.work_item_id) {
      await context.supabase.from("work_items")
        .update({ status: "unassigned" })
        .eq("id", rec.work_item_id).eq("org_id", orgId)
        .in("status", ["pending_approval", "pending_recommendation"]);
    }

    await context.supabase.from("approvals").insert({
      org_id: orgId,
      recommendation_id: data.id,
      approver_user_id: context.userId,
      approver_role: role,
      status: "rejected",
      reason: data.reason ?? null,
      rejected_at: new Date().toISOString(),
    });
    await writeAudit(context, orgId, {
      action: "recommendation.rejected",
      entity_type: "recommendation",
      entity_id: data.id,
      recommendation_id: data.id,
      reason: data.reason,
    });
    return { ok: true };
  });

// ---------- Outcomes ------------------------------------------------------

export const recordOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    work_item_id: z.string().uuid(),
    final_status: z.enum(["completed", "canceled", "no_show", "reassigned", "failed"]),
    actual_resource_id: z.string().uuid().nullable().optional(),
    actual_duration_minutes: z.number().int().nullable().optional(),
    notes: z.string().nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager", "scheduler", "supervisor"]);
    const { data: wi } = await context.supabase
      .from("work_items").select("*").eq("id", data.work_item_id).eq("org_id", orgId).maybeSingle();
    if (!wi) throw new Error("Work item not found");
    const expected = { assigned_resource_id: wi.assigned_resource_id, duration_minutes: wi.duration_minutes };
    const actual = {
      resource_id: data.actual_resource_id ?? wi.assigned_resource_id,
      duration_minutes: data.actual_duration_minutes ?? wi.duration_minutes,
      final_status: data.final_status,
      notes: data.notes,
    };
    const variance = {
      resource_changed: actual.resource_id !== expected.assigned_resource_id,
      duration_delta_minutes: (actual.duration_minutes ?? 0) - (expected.duration_minutes ?? 0),
    };
    const { data: saved, error } = await context.supabase.from("outcomes").insert({
      org_id: orgId,
      work_item_id: data.work_item_id,
      actual_result: actual as never,
      expected_result: expected as never,
      variance: variance as never,
    }).select("*").single();
    if (error) throw new Error(error.message);
    const newStatus = data.final_status === "completed" ? "completed" : data.final_status === "canceled" ? "canceled" : wi.status;
    await context.supabase.from("work_items").update({ status: newStatus }).eq("id", data.work_item_id).eq("org_id", orgId);
    await writeAudit(context, orgId, {
      action: "outcome.recorded", entity_type: "work_item", entity_id: data.work_item_id, new_state: actual, previous_state: expected,
    });
    return saved;
  });

export const listOutcomes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await resolveActiveOrg(context);
    const { data } = await context.supabase.from("outcomes").select("*").eq("org_id", orgId).order("recorded_at", { ascending: false }).limit(200);
    return data ?? [];
  });

// ---------- Audit ---------------------------------------------------------

export const listAuditEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await resolveActiveOrg(context);
    const { data, error } = await context.supabase
      .from("audit_events").select("*").eq("org_id", orgId)
      .order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
