import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
}
walk(path.join(root, "src"));
const joined = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
assert.equal(/from ["']@\/lib\/mock-data["']/.test(joined), false, "Production source imports mock-data");
for (const claim of ["SOC 2 Type II", "GDPR & HIPAA aligned", "127 open appointments", "AI-driven savings this week"]) {
  assert.equal(joined.includes(claim), false, `Unsupported/fabricated claim remains: ${claim}`);
}
const api = fs.readFileSync(path.join(root, "src/routes/api/ai-employee.ts"), "utf8");
assert.ok(api.includes("requireUser(request)"), "AI endpoint is missing authentication");
const shell = fs.readFileSync(path.join(root, "src/routes/_authenticated/_app.tsx"), "utf8");
assert.ok(shell.includes("ai_employee_enabled"), "AI Employee is not feature-gated");

const cadence = fs.readFileSync(path.join(root, "src/lib/cadence.functions.ts"), "utf8");
assert.ok(cadence.includes('.in("status", ["pending", "no_match"])'), "Recommendation reruns do not supersede no-match results");
assert.ok(cadence.includes('record_work_item_outcome'), "Outcome recording is not wired to the atomic database function");
assert.ok(cadence.includes('reason: z.string().trim().min(1).max(500)'), "Cancellation reason is not required server-side");
const schedule = fs.readFileSync(path.join(root, "src/routes/_authenticated/_app.schedule.tsx"), "utf8");
assert.ok(schedule.includes("OutcomeSheet"), "Schedule is missing outcome recording UI");
assert.ok(schedule.includes("draft: serializeItem") || schedule.includes("const draft = serializeItem"), "Eligibility preview does not use unsaved appointment edits");
console.log(`PASS static trust-boundary checks across ${files.length} source files`);
