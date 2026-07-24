import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(process.cwd(), "supabase/migrations/20260724030000_harden_tenant_writes_and_integrity.sql");
const sql = fs.readFileSync(migrationPath, "utf8");

assert.equal((sql.match(/\$\$/g) ?? []).length % 2, 0, "Unbalanced PostgreSQL dollar-quoted blocks");
assert.ok(sql.includes("replace_resource_availability"), "Atomic availability replacement RPC is missing");
assert.ok(sql.includes("execute_recommendation_approval"), "Atomic approval RPC is missing");
assert.ok(sql.includes("execute_recommendation_rejection"), "Atomic rejection RPC is missing");
assert.ok(sql.includes("record_work_item_outcome"), "Atomic outcome RPC is missing");
assert.ok(sql.includes("'superseded','no_match'"), "Recommendation status constraint does not include no_match/superseded");
assert.ok(sql.includes("uq_open_recommendation_per_work_item"), "Open recommendation uniqueness guard is missing");
assert.ok(sql.includes("uq_outcome_per_work_item"), "Outcome uniqueness guard is missing");
assert.equal(sql.includes("public.is_active_org_member"), false, "Migration references a helper moved out of public schema");
assert.equal(sql.includes("public.has_org_role"), false, "Migration references a helper moved out of public schema");

console.log("PASS SQL migration structural checks");
