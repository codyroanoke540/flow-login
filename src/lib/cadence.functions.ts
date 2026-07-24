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


const emptyStringToNull = (value: unknown) => value === "" ? null : value;
const optionalEmail = z.preprocess(emptyStringToNull, z.string().trim().email().nullable().optional());
const optionalNullableString = z.preprocess(emptyStringToNull, z.string().trim().nullable().optional());
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeList(values: string[] | undefined): string[] | undefined {
  if (!values) return undefined;
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value) => {
      const key = value.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeWindow(input: {
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  duration_minutes?: number;
}) {
  const start = input.scheduled_start ? new Date(input.scheduled_start) : null;
  const end = input.scheduled_end ? new Date(input.scheduled_end) : null;
  if (start && Number.isNaN(start.getTime())) throw new Error("Invalid start date/time.");
  if (end && Number.isNaN(end.getTime())) throw new Error("Invalid end date/time.");
  let normalizedEnd = end;
  let duration = input.duration_minutes;
  if (start && !normalizedEnd) {
    duration = Math.max(1, Math.round(duration ?? 60));
    normalizedEnd = new Date(start.getTime() + duration * 60_000);
  }
  if (start && normalizedEnd) {
    if (normalizedEnd <= start) throw new Error("End must be after start.");
    duration = Math.max(1, Math.round((normalizedEnd.getTime() - start.getTime()) / 60_000));
  }
  return {
    scheduled_start: start?.toISOString() ?? input.scheduled_start ?? null,
    scheduled_end: normalizedEnd?.toISOString() ?? input.scheduled_end ?? null,
    duration_minutes: duration,
  };
}

async function assertEntityInOrg(ctx: Ctx, table: string, id: string, orgId: string, label: string) {
  const { data, error } = await ctx.supabase.from(table).select("id").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`${label} not found in the active organization.`);
}

async function resolveActiveOrg(ctx: Ctx): Promise<string> {
  const { data: prof, error: profileError } = await ctx.supabase
    .from("profiles").select("active_organization_id").eq("id", ctx.userId).maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (prof?.active_organization_id) {
    const { data: activeMembership, error: activeMembershipError } = await ctx.supabase
      .from("org_members").select("org_id")
      .eq("org_id", prof.active_organization_id)
      .eq("user_id", ctx.userId)
      .eq("status", "active")
      .maybeSingle();
    if (activeMembershipError) throw new Error(activeMembershipError.message);
    if (activeMembership) return prof.active_organization_id as string;
  }
  const { data: mem, error: membershipError } = await ctx.supabase
    .from("org_members").select("org_id").eq("user_id", ctx.userId).eq("status", "active").order("created_at").limit(1);
  if (membershipError) throw new Error(membershipError.message);
  const orgId = mem?.[0]?.org_id;
  if (!orgId) throw new Error("No active organization for this user.");
  const { error: profileUpdateError } = await ctx.supabase.from("profiles")
    .update({ active_organization_id: orgId }).eq("id", ctx.userId);
  if (profileUpdateError) throw new Error(profileUpdateError.message);
  return orgId as string;
}

async function getRole(ctx: Ctx, orgId: string): Promise<string | null> {
  const { data, error } = await ctx.supabase
    .from("org_members").select("role").eq("org_id", orgId).eq("user_id", ctx.userId).eq("status", "active").maybeSingle();
  if (error) throw new Error(error.message);
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
  const { error } = await ctx.supabase.from("audit_events").insert({
    org_id: orgId,
    actor_user_id: ctx.userId,
    actor_role: role,
    source: event.source ?? "app",
    ...event,
  });
  if (error) throw new Error(`Audit write failed: ${error.message}`);
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
    for (const result of [profileRes, orgRes, memberships]) {
      if (result.error) throw new Error(result.error.message);
    }
    const { data: settings, error: settingsError } = await context.supabase
      .from("organization_settings").select("*").eq("org_id", orgId).maybeSingle();
    if (settingsError) throw new Error(settingsError.message);
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
    const { data: mem, error: membershipError } = await context.supabase
      .from("org_members").select("id").eq("org_id", data.org_id).eq("user_id", context.userId).eq("status", "active").maybeSingle();
    if (membershipError) throw new Error(membershipError.message);
    if (!mem) throw new Error("Not a member of that organization.");
    const { error: updateError } = await context.supabase.from("profiles")
      .update({ active_organization_id: data.org_id }).eq("id", context.userId);
    if (updateError) throw new Error(updateError.message);
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
    email: optionalEmail,
    phone: optionalNullableString,
    type: z.string().default("employee"),
    skills: z.array(z.string()).default([]),
    location_id: z.string().uuid().nullable().optional(),
    weekly_capacity_hours: z.number().min(0).max(168).default(40),
    cost_rate: z.number().min(0).default(0),
    status: z.enum(["active", "inactive"]).default("active"),
    notes: optionalNullableString,
  }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager", "scheduler"]);
    const row: Record<string, unknown> = {
      name: data.name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      type: data.type,
      skills: normalizeList(data.skills) ?? [],
      location_id: data.location_id ?? null,
      capacity: data.weekly_capacity_hours,
      weekly_capacity_hours: data.weekly_capacity_hours,
      cost_rate: data.cost_rate,
      status: data.status,
      notes: data.notes ?? null,
    };
    let saved: any = null;
    if (data.id) {
      const { data: r, error } = await context.supabase
        .from("resources").update(row as never).eq("id", data.id).eq("org_id", orgId).select("*").single();
      if (error) throw new Error(error.message);
      saved = r;
    } else {
      const { data: r, error } = await context.supabase
        .from("resources").insert({ ...row, org_id: orgId } as never).select("*").single();
      if (error) throw new Error(error.message);
      saved = r;
    }
    if (!saved) throw new Error("Failed to persist resource");
    await writeAudit(context, orgId, {
      action: data.id ? "resource.updated" : "resource.created",
      entity_type: "resource", entity_id: saved.id as string, new_state: saved,
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
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager", "scheduler"]);
    await assertEntityInOrg(context, "resources", data.resource_id, orgId, "Resource");
    const seen = new Set<string>();
    const byDay = new Map<number, Array<{ start: string; end: string }>>();
    for (const slot of data.slots) {
      if (!TIME_RE.test(slot.start_time) || !TIME_RE.test(slot.end_time)) throw new Error("Availability times must use HH:MM format.");
      const start = slot.start_time.slice(0, 5);
      const end = slot.end_time.slice(0, 5);
      if (start >= end) throw new Error("Availability end must be after start.");
      const key = `${slot.weekday}:${start}-${end}`;
      if (seen.has(key)) throw new Error("Duplicate availability window.");
      seen.add(key);
      const day = byDay.get(slot.weekday) ?? [];
      if (day.some((other) => start < other.end && other.start < end)) throw new Error("Availability windows cannot overlap.");
      day.push({ start, end });
      byDay.set(slot.weekday, day);
    }
    const slots = data.slots.map((slot) => ({
      weekday: slot.weekday,
      start_time: slot.start_time.slice(0, 5),
      end_time: slot.end_time.slice(0, 5),
    }));
    const { error } = await (context.supabase.rpc as any)("replace_resource_availability", {
      _resource_id: data.resource_id,
      _slots: slots,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await resolveActiveOrg(context);
    const { data, error } = await context.supabase.from("resource_availability").select("*").eq("org_id", orgId);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Qualifications -------------------------------------------------

export const addResourceQualification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    resource_id: z.string().uuid(),
    qualification_code: z.string().min(1),
    qualification_name: z.string().nullable().optional(),
    qualification_type: z.string().nullable().optional(),
    credential_number: z.string().nullable().optional(),
    status: z.enum(["active", "inactive", "suspended", "revoked"]).default("active"),
    notes: z.string().nullable().optional(),
    issued_on: z.string().nullable().optional(),
    expires_on: z.string().nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager", "scheduler"]);
    await assertEntityInOrg(context, "resources", data.resource_id, orgId, "Resource");
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (data.issued_on && !datePattern.test(data.issued_on)) throw new Error("Issue date must use YYYY-MM-DD.");
    if (data.expires_on && !datePattern.test(data.expires_on)) throw new Error("Expiration date must use YYYY-MM-DD.");
    if (data.issued_on && data.expires_on && data.expires_on < data.issued_on) {
      throw new Error("Expiration date cannot be before issue date.");
    }
    data.qualification_code = data.qualification_code.trim();
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
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager", "scheduler"]);
    const { error } = await context.supabase.from("resource_qualifications").delete().eq("id", data.id).eq("org_id", orgId);
    if (error) throw new Error(error.message);
    await writeAudit(context, orgId, { action: "qualification.removed", entity_type: "resource_qualifications", entity_id: data.id });
    return { ok: true };
  });

export const listResourceQualifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await resolveActiveOrg(context);
    const { data, error } = await context.supabase.from("resource_qualifications").select("*").eq("org_id", orgId);
    if (error) throw new Error(error.message);
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
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager", "scheduler"]);
    await assertEntityInOrg(context, "resources", data.resource_id, orgId, "Resource");
    const startsAt = new Date(data.starts_at);
    const endsAt = new Date(data.ends_at);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw new Error("Invalid time-off date/time.");
    if (endsAt <= startsAt) throw new Error("Time-off end must be after start.");
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
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager", "scheduler"]);
    const { error } = await context.supabase.from("resource_time_off").delete().eq("id", data.id).eq("org_id", orgId);
    if (error) throw new Error(error.message);
    await writeAudit(context, orgId, { action: "time_off.deleted", entity_type: "resource_time_off", entity_id: data.id });
    return { ok: true };
  });

export const listTimeOff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await resolveActiveOrg(context);
    const { data, error } = await context.supabase.from("resource_time_off").select("*").eq("org_id", orgId).order("starts_at");
    if (error) throw new Error(error.message);
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
    contact_name: optionalNullableString,
    contact_email: optionalEmail,
    contact_phone: optionalNullableString,
    service_address: optionalNullableString,
    city: optionalNullableString,
    state: optionalNullableString,
    zip: optionalNullableString,
    timezone: optionalNullableString,
    required_skills: z.array(z.string()).default([]),
    required_qualifications: z.array(z.string()).default([]),
    preferred_resource_ids: z.array(z.string().uuid()).optional(),
    default_duration_minutes: z.number().int().positive().max(1440).optional(),
    notes: optionalNullableString,
    preferences: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(["active", "inactive"]).default("active"),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager", "scheduler"]);
    if (data.timezone && !isValidTimezone(data.timezone)) throw new Error("Timezone must be a valid IANA name, such as America/New_York.");
    for (const resourceId of data.preferred_resource_ids ?? []) {
      await assertEntityInOrg(context, "resources", resourceId, orgId, "Preferred resource");
    }
    const { id, ...parsed } = data;
    const rest: Record<string, unknown> = Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== undefined));
    rest.required_skills = normalizeList(data.required_skills) ?? [];
    rest.required_qualifications = normalizeList(data.required_qualifications) ?? [];
    if (!id) {
      rest.type ??= "customer";
      rest.tier ??= "standard";
      rest.status ??= "active";
      rest.default_duration_minutes ??= 60;
      rest.preferred_resource_ids ??= [];
      rest.preferences ??= {};
    }
    let saved: any = null;
    if (id) {
      const { data: r, error } = await context.supabase
        .from("accounts").update(rest as never).eq("id", id).eq("org_id", orgId).select("*").single();
      if (error) throw new Error(error.message);
      saved = r;
    } else {
      const { data: r, error } = await context.supabase
        .from("accounts").insert({ ...rest, org_id: orgId } as never).select("*").single();
      if (error) throw new Error(error.message);
      saved = r;
    }
    if (!saved) throw new Error("Failed to persist account");
    await writeAudit(context, orgId, {
      action: id ? "account.updated" : "account.created",
      entity_type: "account", entity_id: saved.id as string, new_state: saved,
    });
    return saved;
  });

export const setAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["active", "inactive"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager"]);
    const { data: saved, error } = await context.supabase
      .from("accounts").update({ status: data.status } as never)
      .eq("id", data.id).eq("org_id", orgId).select("*").single();
    if (error) throw new Error(error.message);
    await writeAudit(context, orgId, {
      action: "account.status_changed", entity_type: "account", entity_id: data.id, new_state: { status: data.status },
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
    if (data.account_id) await assertEntityInOrg(context, "accounts", data.account_id, orgId, "Account");
    const window = normalizeWindow(data);
    const row = {
      ...data,
      ...window,
      required_skills: normalizeList(data.required_skills) ?? [],
      required_qualifications: normalizeList(data.required_qualifications) ?? [],
      org_id: orgId,
      status: "unassigned" as const,
    };
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
    type: z.string().optional(),
    account_id: z.string().uuid().nullable().optional(),
    scheduled_start: z.string().nullable().optional(),
    scheduled_end: z.string().nullable().optional(),
    duration_minutes: z.number().int().positive().optional(),
    required_skills: z.array(z.string()).optional(),
    required_qualifications: z.array(z.string()).optional(),
    priority: z.number().int().min(1).max(5).optional(),
    status: z.enum(["unassigned", "pending_recommendation", "pending_approval", "assigned", "scheduled", "in_progress", "completed", "canceled"]).optional(),
    assigned_resource_id: z.string().uuid().nullable().optional(),
    location_id: z.string().uuid().nullable().optional(),
    deadline: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager", "scheduler"]);
    const { id, ...incoming } = data;
    const { data: current, error: currentError } = await context.supabase
      .from("work_items").select("*").eq("id", id).eq("org_id", orgId).single();
    if (currentError || !current) throw new Error(currentError?.message ?? "Work item not found.");
    if (incoming.account_id) await assertEntityInOrg(context, "accounts", incoming.account_id, orgId, "Account");
    if (incoming.assigned_resource_id) await assertEntityInOrg(context, "resources", incoming.assigned_resource_id, orgId, "Resource");
    const merged = { ...current, ...incoming };
    const window = normalizeWindow(merged);
    const patch = {
      ...incoming,
      ...window,
      required_skills: incoming.required_skills ? normalizeList(incoming.required_skills) : undefined,
      required_qualifications: incoming.required_qualifications ? normalizeList(incoming.required_qualifications) : undefined,
    };
    const cleanPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    const decisionFields = [
      "account_id", "scheduled_start", "scheduled_end", "duration_minutes",
      "required_skills", "required_qualifications", "location_id",
    ];
    const decisionInputsChanged = decisionFields.some((key) => key in incoming);
    if (decisionInputsChanged && current.assigned_resource_id) {
      cleanPatch.assigned_resource_id = null;
      cleanPatch.status = "unassigned";
    }
    if (decisionInputsChanged) {
      const { error: supersedeError } = await context.supabase.from("recommendations")
        .update({ status: "superseded" })
        .eq("org_id", orgId).eq("work_item_id", id).in("status", ["pending", "no_match"]);
      if (supersedeError) throw new Error(supersedeError.message);
    }
    const { data: saved, error } = await context.supabase
      .from("work_items").update(cleanPatch as any).eq("id", id).eq("org_id", orgId).select("*").single();
    if (error) throw new Error(error.message);
    await writeAudit(context, orgId, { action: "work_item.updated", entity_type: "work_item", entity_id: id, new_state: saved });
    return saved;
  });

export const previewCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    work_item_id: z.string().uuid(),
    draft: z.object({
      title: z.string().optional(),
      account_id: z.string().uuid().nullable().optional(),
      scheduled_start: z.string().nullable().optional(),
      scheduled_end: z.string().nullable().optional(),
      duration_minutes: z.number().int().positive().optional(),
      required_skills: z.array(z.string()).optional(),
      required_qualifications: z.array(z.string()).optional(),
      priority: z.number().int().min(1).max(5).optional(),
    }).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    const ctx = await loadPipelineContext(context.supabase, orgId, data.work_item_id);
    if (data.draft) {
      const merged = { ...ctx.workItem, ...data.draft };
      const window = normalizeWindow(merged);
      ctx.workItem = {
        ...merged,
        ...window,
        required_skills: normalizeList(merged.required_skills) ?? [],
        required_qualifications: normalizeList(merged.required_qualifications) ?? [],
      } as WorkItem;
      if (ctx.workItem.account_id && ctx.workItem.account_id !== ctx.account?.id) {
        const { data: account } = await context.supabase.from("accounts").select("*")
          .eq("id", ctx.workItem.account_id).eq("org_id", orgId).maybeSingle();
        ctx.account = (account as Account) ?? null;
      } else if (!ctx.workItem.account_id) {
        ctx.account = null;
      }
      ctx.workItem.timezone = ctx.account?.timezone || ctx.organizationTimezone || "UTC";
    }
    if (!ctx.workItem.scheduled_start) throw new Error("Set an appointment date and start time before checking eligibility.");
    const { scored } = runPipeline({ trigger: "preview", ...ctx, approvalLevel: 2 });
    return scored
      .map((c) => ({
        resource_id: c.resource.id,
        resource_name: c.resource.name,
        eligible: c.score !== null,
        score: c.score,
        factors: c.factors,
        disqualifiers: c.disqualifiers,
      }))
      .sort((a, b) => {
        if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
        return (b.score ?? -1) - (a.score ?? -1);
      });
  });

export const cancelWorkItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), reason: z.string().trim().min(1).max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager", "scheduler"]);
    const { error: supersedeError } = await context.supabase.from("recommendations")
      .update({ status: "superseded" })
      .eq("org_id", orgId).eq("work_item_id", data.id).in("status", ["pending", "no_match"]);
    if (supersedeError) throw new Error(supersedeError.message);
    const { data: saved, error } = await context.supabase
      .from("work_items").update({ status: "canceled", canceled_reason: data.reason } as never)
      .eq("id", data.id).eq("org_id", orgId).select("*").single();
    if (error) throw new Error(error.message);
    await writeAudit(context, orgId, { action: "work_item.canceled", entity_type: "work_item", entity_id: data.id, reason: data.reason, new_state: saved });
    return saved;
  });

// ---------- Decision pipeline --------------------------------------------

async function loadPipelineContext(supabase: any, orgId: string, workItemId: string) {
  const [workItemRes, resourcesRes, availabilityRes, qualsRes, timeOffRes, constraintsRes, assignmentsRes, organizationRes] = await Promise.all([
    supabase.from("work_items").select("*").eq("id", workItemId).eq("org_id", orgId).single(),
    supabase.from("resources").select("*").eq("org_id", orgId),
    supabase.from("resource_availability").select("*").eq("org_id", orgId),
    supabase.from("resource_qualifications").select("*").eq("org_id", orgId),
    supabase.from("resource_time_off").select("*").eq("org_id", orgId).eq("status", "approved"),
    supabase.from("decision_constraints").select("*").eq("org_id", orgId).eq("active", true),
    supabase.from("work_items").select("id, assigned_resource_id, scheduled_start, scheduled_end, duration_minutes")
      .eq("org_id", orgId).not("assigned_resource_id", "is", null).neq("status", "canceled"),
    supabase.from("organizations").select("timezone").eq("id", orgId).maybeSingle(),
  ]);

  const contextErrors = [
    workItemRes.error, resourcesRes.error, availabilityRes.error, qualsRes.error,
    timeOffRes.error, constraintsRes.error, assignmentsRes.error, organizationRes.error,
  ].filter(Boolean);
  if (contextErrors.length) throw new Error(contextErrors[0].message);
  if (!workItemRes.data) throw new Error("Work item not found.");
  const workItem = workItemRes.data as WorkItem;

  let account: Account | null = null;
  if (workItem.account_id) {
    const { data, error } = await supabase.from("accounts").select("*").eq("id", workItem.account_id).eq("org_id", orgId).single();
    if (error) throw new Error(error.message);
    account = (data as Account) ?? null;
  }
  workItem.timezone = account?.timezone || organizationRes.data?.timezone || "UTC";

  const assignments: AssignedWindow[] = ((assignmentsRes.data ?? []) as any[]).map((r) => {
    const start = r.scheduled_start ? new Date(r.scheduled_start).toISOString() : new Date().toISOString();
    const end = r.scheduled_end
      ? new Date(r.scheduled_end).toISOString()
      : new Date(new Date(start).getTime() + (r.duration_minutes || 60) * 60_000).toISOString();
    return { resource_id: r.assigned_resource_id, work_item_id: r.id, scheduled_start: start, scheduled_end: end };
  });

  const load: ResourceLoad[] = [];
  const target = workItem.scheduled_start ? new Date(workItem.scheduled_start) : new Date();
  const timezone = workItem.timezone || "UTC";
  const targetLocal = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(target);
  const part = (type: Intl.DateTimeFormatPartTypes) => targetLocal.find((p) => p.type === type)?.value ?? "";
  const weekdayIndex = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[part("weekday")] ?? 0;
  const targetDateKey = `${part("year")}-${part("month")}-${part("day")}`;
  const targetDateUtc = new Date(`${targetDateKey}T00:00:00Z`);
  const weekStartDate = new Date(targetDateUtc);
  weekStartDate.setUTCDate(targetDateUtc.getUTCDate() - weekdayIndex);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 7);
  const weekStartKey = weekStartDate.toISOString().slice(0, 10);
  const weekEndKey = weekEndDate.toISOString().slice(0, 10);
  const localDateKey = (value: string) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date(value));
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  };
  for (const a of assignments) {
    const startKey = localDateKey(a.scheduled_start);
    if (startKey >= weekStartKey && startKey < weekEndKey) {
      const start = new Date(a.scheduled_start);
      const mins = Math.max(0, (new Date(a.scheduled_end).getTime() - start.getTime()) / 60_000);
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
    organizationTimezone: organizationRes.data?.timezone || "UTC",
  };
}

export const runRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ work_item_id: z.string().uuid(), trigger: z.string().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager", "scheduler", "supervisor"]);
    const ctx = await loadPipelineContext(context.supabase, orgId, data.work_item_id);
    if (!ctx.workItem.scheduled_start) throw new Error("Set an appointment date and start time before generating a recommendation.");
    const { error: supersedeError } = await context.supabase.from("recommendations")
      .update({ status: "superseded" })
      .eq("org_id", orgId).eq("work_item_id", data.work_item_id).in("status", ["pending", "no_match"]);
    if (supersedeError) throw new Error(supersedeError.message);
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
        status: dto.recommendation.resource_id ? "pending" : "no_match",
      } as never)
      .select("*").single();
    if (error) throw new Error(error.message);

    let eligibleRank = 0;
    const candidateRows = scored
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
      .map((c) => ({
        org_id: orgId,
        recommendation_id: saved.id,
        resource_id: c.resource.id,
        resource_name: c.resource.name,
        eligible: c.score !== null,
        disqualification_reasons: c.disqualifiers as never,
        factor_scores: c.factors as never,
        weighted_score: c.score,
        rank: c.score !== null ? ++eligibleRank : null,
        explanation: c.explanation ?? null,
      }));
    if (candidateRows.length) {
      const { error: candidateError } = await context.supabase.from("recommendation_candidates").insert(candidateRows);
      if (candidateError) throw new Error(candidateError.message);
    }

    const { error: workItemStatusError } = await context.supabase.from("work_items")
      .update({ status: dto.recommendation.resource_id ? "pending_approval" : "unassigned" })
      .eq("id", ctx.workItem.id).eq("org_id", orgId);
    if (workItemStatusError) throw new Error(workItemStatusError.message);

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
    const { data: rows, error } = await context.supabase
      .from("recommendation_candidates").select("*")
      .eq("recommendation_id", data.recommendation_id).eq("org_id", orgId)
      .order("eligible", { ascending: false }).order("weighted_score", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
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

    const { error: executeError } = await context.supabase.rpc("execute_recommendation_approval", {
      _recommendation_id: data.id,
      _expected_resource_id: selected.resource_id,
    });
    if (executeError) throw new Error(executeError.message);

    return { ok: true };
  });

export const rejectRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), reason: z.string().trim().max(500).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager", "scheduler", "supervisor"]);
    const { error } = await context.supabase.rpc("execute_recommendation_rejection", {
      _recommendation_id: data.id,
      _reason: data.reason ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Outcomes ------------------------------------------------------

export const recordOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    work_item_id: z.string().uuid(),
    final_status: z.enum(["completed", "canceled", "no_show", "failed"]),
    actual_resource_id: z.string().uuid().nullable().optional(),
    actual_duration_minutes: z.number().int().positive().max(1440).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    assertRole(await getRole(context, orgId), ["owner", "admin", "operations_manager", "scheduler", "supervisor"]);
    await assertEntityInOrg(context, "work_items", data.work_item_id, orgId, "Work item");
    if (data.actual_resource_id) {
      await assertEntityInOrg(context, "resources", data.actual_resource_id, orgId, "Resource");
    }
    const { data: outcomeId, error: rpcError } = await context.supabase.rpc("record_work_item_outcome", {
      _work_item_id: data.work_item_id,
      _final_status: data.final_status,
      _actual_resource_id: data.actual_resource_id ?? null,
      _actual_duration_minutes: data.actual_duration_minutes ?? null,
      _notes: data.notes ?? null,
    });
    if (rpcError) throw new Error(rpcError.message);
    const { data: saved, error } = await context.supabase.from("outcomes")
      .select("*").eq("id", outcomeId).eq("org_id", orgId).single();
    if (error) throw new Error(error.message);
    return saved;
  });

export const listOutcomes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await resolveActiveOrg(context);
    const { data, error } = await context.supabase.from("outcomes").select("*").eq("org_id", orgId).order("recorded_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Audit ---------------------------------------------------------

export const listAuditEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await resolveActiveOrg(context);
    assertRole(await getRole(context, orgId), ["owner", "admin"]);
    const { data, error } = await context.supabase
      .from("audit_events").select("*").eq("org_id", orgId)
      .order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Organization (name / website / timezone) ---------------------

export const updateOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    name: z.string().min(1).max(120).optional(),
    website: z.string().url().nullable().optional(),
    timezone: z.string().min(1).max(64).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context);
    assertRole(await getRole(context, orgId), ["owner", "admin"]);
    if (data.timezone !== undefined && !isValidTimezone(data.timezone)) {
      throw new Error("Timezone must be a valid IANA name, such as America/New_York.");
    }
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.website !== undefined) patch.website = data.website;
    if (data.timezone !== undefined) patch.timezone = data.timezone;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { data: saved, error } = await context.supabase
      .from("organizations").update(patch as never).eq("id", orgId).select("*").single();
    if (error) throw new Error(error.message);
    await writeAudit(context, orgId, {
      action: "organization.updated",
      entity_type: "organization",
      entity_id: orgId,
      new_state: saved,
    });
    return saved;
  });
