# AI Employee Framework — Implementation Plan

Goal: evolve Cadence into an AI Operations Platform where the **scheduling engine stays the source of truth** and AI Employees act on top of it via a provider-agnostic layer. This pass ships the foundation + a working "AI Employee" assistant on every authenticated page, wired to Lovable AI (OpenAI today, swappable tomorrow).

## Scope of this pass

In:
1. Provider abstraction (server) — one interface, OpenAI-compatible via Lovable AI Gateway, ready for Claude/Gemini/etc.
2. AI Employee floating panel available on every `_authenticated/_app/*` page, with page context awareness.
3. Streaming chat server route using AI SDK + Lovable AI (`google/gemini-3.5-flash` default; model id abstracted).
4. Tool-calling scaffold with Level 1/2/3 permission classification (approval gate in UI for L2/L3).
5. Explainability payload on every tool result (reasoning, impact, confidence, alternatives — mocked where no real signal exists).
6. Lightweight in-browser memory (localStorage) for preferences + recent conversation; server-side memory hook stubbed for future DB.
7. Operations Dashboard additions: conflicts, late employees, reassignments, missing docs, payroll warnings, cancellations, weather, travel opps, productivity, approvals — all from mock-data.
8. Integrations registry stub (Google Cal, Outlook, Slack, Teams, Twilio, EMR, CRM, Accounting, Maps, Weather, "Viktor") — modular list, no real OAuth.
9. Multi-role AI Employee registry (Scheduling/Ops/HR/Compliance/Payroll/Billing/Support/EA/Analytics) with per-role system prompts + tool allowlists.

Out (explicitly deferred):
- Real writes to a scheduling engine (no DB schema for schedules yet).
- Real OAuth integrations.
- Server-side persistent memory (structure in place, storage swap later).
- Voice / drag-drop / map view.

## Architecture

```
src/
  lib/
    ai/
      providers/
        types.ts              # ChatProvider interface (stream, tools, models)
        lovable.ts            # LovableAI implementation (OpenAI-compatible gateway)
        index.ts              # getProvider(name) — swap point
      roles.ts                # AI Employee roles + system prompts + allowed tools
      tools/
        index.ts              # tool registry w/ permission level + explainability schema
        schedule.ts           # read/suggest/modify (L1/L2/L3) — mock impl
        comms.ts              # draft email/sms (L2)
        reports.ts            # summarize/report (L1)
      memory.ts               # get/set preferences + recent turns (localStorage now)
      permissions.ts          # Level 1/2/3 helpers + approval gate types
  routes/api/
    ai-employee.ts            # POST streaming chat route (AI SDK + Lovable provider)
  components/
    ai-employee/
      ai-employee-panel.tsx   # floating panel, open/collapse, role switcher
      ai-employee-launcher.tsx# FAB, mounted in _app.tsx
      message.tsx             # renders text + tool parts + approval UI
      approval-card.tsx       # L2/L3 approve/dismiss with explainability
```

Mount `<AiEmployeeLauncher />` inside `_authenticated/_app.tsx` so it appears on every authenticated page. Panel reads `useRouterState` to pass current route + a small page-context object as a system message.

## Provider abstraction

```ts
// providers/types.ts
export interface ChatProvider {
  name: string;
  defaultModel: string;
  stream(opts: { messages: UIMessage[]; tools?: ToolSet; system?: string; model?: string }): Promise<Response>;
}
```

`lovable.ts` implements it using `@ai-sdk/openai-compatible` + `streamText` (per `ai-sdk-lovable-gateway` knowledge). Adding Claude/Gemini later = new file, no call-site changes.

## Permissions

Every tool declares `level: 1 | 2 | 3`. L1 executes immediately. L2/L3 return a proposed-action payload; UI renders an approval card; on approve, the client re-invokes the tool with `approved: true`.

## Explainability

Tool results conform to:
```ts
type Explainable<T> = { data: T; explain: { reasoning: string; expectedOutcome: string; impact: string; timeSaved?: string; costSaved?: string; confidence: number; alternatives?: string[] } };
```

## Ops Dashboard

Extend `mock-data.ts` with: `conflicts`, `lateEmployees`, `reassignments`, `missingDocs`, `payrollWarnings`, `cancellations`, `weatherAlerts`, `travelOpps`, `productivity`, `pendingApprovals`. Add a "Today" section to `_app.operations.tsx` surfacing these as compact cards linked to the AI Employee ("Ask AI to resolve").

## UX

- FAB bottom-right, `⌘K`-like affordance, glass panel 420px, slides from right on desktop, sheet on mobile.
- Composer uses AI Elements (`prompt-input`, `conversation`, `message`, `tool`, `shimmer`).
- Role switcher in panel header (default: Operations Manager).
- Suggested prompts seeded from page context.

## Secrets

`LOVABLE_API_KEY` already provisioned. Server-only.

## Verification

- `tsgo` typecheck.
- Manual: open any authenticated route → FAB visible → open panel → send "Who is overloaded tomorrow?" → streaming response → try an L2 action → approval card appears.

## Explicitly not doing (say no now)

- Real scheduling writes, real OAuth to Google/Slack/etc., persistent server memory, real weather API. All mocked with clean seams to swap in later.
