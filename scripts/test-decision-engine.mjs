import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let ts;
try {
  ts = require("typescript");
} catch {
  ts = require("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js");
}

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cadence-engine-"));
fs.writeFileSync(path.join(temp, "package.json"), '{"type":"commonjs"}');
for (const name of ["types", "engine"]) {
  const source = fs.readFileSync(path.join(root, "src/lib/decision", `${name}.ts`), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: `${name}.ts`,
    reportDiagnostics: true,
  });
  const errors = (output.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `${name}.ts transpile errors: ${errors.map((e) => e.messageText).join("; ")}`);
  fs.writeFileSync(path.join(temp, `${name}.js`), output.outputText);
}
const { runPipeline } = require(path.join(temp, "engine.js"));

const resource = (overrides = {}) => ({
  id: "r1", org_id: "o1", name: "Sarah", type: "Therapist", skills: ["Behavior Support"],
  location_id: null, capacity: 40, weekly_capacity_hours: 40, cost_rate: 40,
  status: "active", metadata: {}, ...overrides,
});
const work = (overrides = {}) => ({
  id: "w1", org_id: "o1", title: "Demo Session", type: "appointment", account_id: "a1",
  required_skills: ["Behavior Support"], required_qualifications: ["RBT"], duration_minutes: 120,
  priority: 3, deadline: null, scheduled_start: "2026-07-28T18:00:00.000Z",
  scheduled_end: "2026-07-28T20:00:00.000Z", location_id: null, status: "unassigned",
  assigned_resource_id: null, metadata: {}, timezone: "America/New_York", ...overrides,
});
const account = (overrides = {}) => ({
  id: "a1", org_id: "o1", name: "Demo Client", type: "ABA", tier: "standard",
  preferences: {}, location_id: null, required_skills: [], required_qualifications: [],
  preferred_resource_ids: [], timezone: "America/New_York", ...overrides,
});
const availability = (overrides = {}) => ({ id: "av1", resource_id: "r1", weekday: 2, start_time: "13:00", end_time: "17:00", ...overrides });
const qualification = (overrides = {}) => ({ id: "q1", resource_id: "r1", qualification_code: "RBT", expires_on: "2027-07-28", status: "active", ...overrides });

function evaluate(overrides = {}) {
  return runPipeline({
    trigger: "test", workItem: work(overrides.workItem), account: overrides.account === null ? null : account(overrides.account),
    resources: overrides.resources ?? [resource()], availability: overrides.availability ?? [availability()],
    quals: overrides.quals ?? [qualification()], timeOff: overrides.timeOff ?? [], assignments: overrides.assignments ?? [],
    constraints: overrides.constraints ?? [], load: overrides.load ?? [], approvalLevel: 2,
  });
}
function candidate(result, id = "r1") { return result.scored.find((x) => x.resource.id === id); }
function reasonCodes(result, id = "r1") { return candidate(result, id).disqualifiers.map((x) => x.code); }

const tests = [
  ["eligible resource ranks first", () => assert.equal(candidate(evaluate()).score !== null, true)],
  ["organization timezone is used for weekly availability", () => assert.equal(reasonCodes(evaluate()).includes("unavailable"), false)],
  ["missing weekly availability disqualifies", () => assert.ok(reasonCodes(evaluate({ availability: [] })).includes("unavailable"))],
  ["partial-day availability disqualifies", () => assert.ok(reasonCodes(evaluate({ availability: [availability({ start_time: "08:00", end_time: "12:00" })] })).includes("unavailable"))],
  ["time off disqualifies", () => assert.ok(reasonCodes(evaluate({ timeOff: [{ id: "t1", resource_id: "r1", starts_at: "2026-07-28T17:30:00Z", ends_at: "2026-07-28T20:30:00Z", status: "approved" }] })).includes("time_off"))],
  ["double booking disqualifies", () => assert.ok(reasonCodes(evaluate({ assignments: [{ resource_id: "r1", work_item_id: "other", scheduled_start: "2026-07-28T19:00:00Z", scheduled_end: "2026-07-28T21:00:00Z" }] })).includes("overlap"))],
  ["missing qualification disqualifies", () => assert.ok(reasonCodes(evaluate({ quals: [] })).includes("missing_qualification"))],
  ["revoked qualification does not count", () => assert.ok(reasonCodes(evaluate({ quals: [qualification({ status: "revoked" })] })).includes("missing_qualification"))],
  ["expired qualification disqualifies", () => assert.ok(reasonCodes(evaluate({ quals: [qualification({ expires_on: "2026-07-27" })] })).includes("expired_qualification"))],
  ["qualification remains valid through expiration date", () => assert.equal(reasonCodes(evaluate({ quals: [qualification({ expires_on: "2026-07-28" })] })).includes("expired_qualification"), false)],
  ["customer requirements are merged into work item requirements", () => assert.ok(reasonCodes(evaluate({ account: { required_skills: ["Crisis Support"] }, workItem: { required_skills: [] } })).includes("missing_skill"))],
  ["inactive resource disqualifies", () => assert.ok(reasonCodes(evaluate({ resources: [resource({ status: "inactive" })] })).includes("inactive"))],
  ["capacity uses actual start/end duration", () => assert.ok(reasonCodes(evaluate({ workItem: { duration_minutes: 15 }, load: [{ resource_id: "r1", minutes_scheduled: 39 * 60 }] })).includes("capacity_exceeded"))],
  ["no-match recommendation has no selected resource", () => assert.equal(evaluate({ resources: [resource({ status: "inactive" })] }).dto.recommendation.resource_id, null)],
];

let passed = 0;
for (const [name, fn] of tests) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); console.error(error); process.exitCode = 1; }
}
console.log(`\n${passed}/${tests.length} decision-engine tests passed`);
fs.rmSync(temp, { recursive: true, force: true });
