# Cadence — AI Operations Platform

Reposition Cadence from "AI scheduling" to an **AI Operations Platform** (long-term: AI Chief Operating Officer for service businesses). First customer is an ABA company, but nothing in the core product is ABA-specific — industry terminology and modules are pluggable.

Design language: Stripe × Linear × Notion × Vercel × Apple. Minimal, premium, generous whitespace, soft shadows, rounded corners, refined typography (Space Grotesk display / Inter body — already wired), a restrained gradient accent (navy → teal). No generic dashboard-template feel.

## 1. Landing page (`/`)
Keep structure, rewrite messaging.
- New headline: **"The AI Operating System for Service Businesses."**
- Sub: "Cadence runs the operations of your business — scheduling, staffing, dispatch, and optimization — so your team can focus on the work."
- Add three quiet capability tiles under the hero (AI Operations, Intelligent Scheduling, Workforce Orchestration) — no clutter, no logos.
- CTAs unchanged (Get started / Sign in).

## 2. Auth (`/auth`)
- Rename "Create Workspace" → **"Create Organization"**.
- Sub-copy: "Companies use Cadence to run secure, isolated organizations for their operations."
- No other flow changes.

## 3. App shell for authenticated area
New pathless layout `src/routes/_authenticated/_app.tsx` that renders:
- **Left sidebar** (shadcn sidebar, collapsible to icon rail): Dashboard, Schedule, Employees, Customers, Analytics, AI Assistant, Automations, Integrations, Settings. Grouped so future industry modules can slot under a "Modules" section later.
- **Top bar**: org switcher (static for now), global search input, notifications icon, user menu (sign out).
- `<Outlet />` for content.

All authenticated routes move under this layout:
- `/dashboard` (rewrite)
- `/schedule`, `/employees`, `/customers`, `/analytics`, `/ai`, `/automations`, `/integrations`, `/settings` (new, scaffolded)

Terminology is centralized in `src/lib/terminology.ts` (e.g. `customers`, `employees`, `appointments`) so industry modules can override later.

## 4. Executive Dashboard (`/dashboard`)
Hero **AI Briefing** card at the top:
- "Good morning, {firstName}." (time-of-day aware)
- "I analyzed your business overnight."
- Bulleted summary: scheduling conflicts, unavailable employees, estimated labor savings, travel time reduced, revenue opportunities, overtime warnings, AI recommendations waiting.
- Primary CTA **Review AI Recommendations** → `/ai`. Secondary **Open Schedule** → `/schedule`.

**KPI grid** (7 cards, responsive 2/3/4 col):
Employees Working Today · Open Appointments · Schedule Health Score · Travel Efficiency · Labor Cost · Customer Satisfaction · AI Confidence Score. Each: label, big value, delta vs yesterday, sparkline-style accent bar.

**Today at a glance** row: upcoming appointments list + top 3 AI recommendations preview.

All data mocked in `src/lib/mock-data.ts` — real data wiring comes later.

## 5. AI Command Center (`/ai`)
Not a chatbot. A prioritized stream of recommendations. Each card:
- Title, category chip (Conflict / Overtime / Travel / Revenue / Staffing / Burnout / Cancellation risk)
- Problem, Reason, **Confidence %**, **Estimated impact** ($, hours, or %)
- Recommended action summary
- Buttons: **Approve**, **Dismiss**, **Explain** (opens a side drawer with reasoning)
Filter bar (category, confidence, impact). Empty-state feels calm, not empty.

## 6. Schedule (`/schedule`)
View switcher: **Day · Week · Month · List · Map · Timeline**. Ship Week as the polished default with a real week grid; Day/List rendered; Month/Map/Timeline shown as tasteful placeholders labeled "Coming soon" so they don't feel broken. Appointment blocks include an AI-suggestion glyph when relevant. Drag-and-drop is out of scope for this pass (documented as follow-up) — the surface is designed to receive it.

## 7. Employees (`/employees`)
Grid + list toggle. Each employee card: avatar, name, role, status pill (Available / Working / Off), skills chips, certifications, location, current workload bar, next appointment. Search + filters (role, skill, availability, location). "Add Employee" button opens a sheet (form only, no persistence this pass).

## 8. Customers (`/customers`)
Industry-neutral. Table with name, primary contact, location, tags, last appointment, lifetime value, status. Search + filters. Detail drawer on row click.

## 9. Analytics (`/analytics`)
Executive report cards using `recharts`: Labor Utilization, Travel Efficiency, Revenue, Appointment Completion, AI Savings, Operational Efficiency. Date-range selector in header. Mock data.

## 10. Automations (`/automations`)
List of automation rules as cards with a WHEN / THEN structure and on/off toggle. Seed three:
- "If an employee calls out → recommend replacements."
- "If an appointment is cancelled → notify scheduler."
- "If overtime exceeds threshold → alert manager."
"New Automation" button opens a sheet with trigger/action pickers (UI only).

## 11. Integrations & Settings
Both scaffolded with real layout but light content — integration tiles (Google Calendar, Slack, QuickBooks, Twilio, Zapier — all "Connect" placeholders); Settings with tabs (Organization, Members, Billing, Security, Terminology).

## Technical notes
- Routing: add `src/routes/_authenticated/_app.tsx` (renders sidebar shell + `<Outlet />`), then convert `_authenticated/dashboard.tsx` and add the new pages as `_authenticated/_app.*.tsx`. Keeps the auth gate intact.
- Use existing shadcn primitives; add `sidebar`, `sheet`, `tabs`, `avatar`, `badge`, `progress`, `chart` as needed via existing components.
- No database changes. All new screens read from `src/lib/mock-data.ts` so we can wire real data later without UI churn.
- No new backend/edge functions. No changes to auth, migrations, or Supabase clients.
- Terminology helper (`useTerminology()`) so future industry modules can rename Customers/Employees/Appointments without touching components.

## Out of scope (called out for follow-ups)
- Real drag-and-drop scheduling, map view, timeline gantt.
- Persisting employees/customers/automations to the database.
- Multi-org switching logic and RBAC.
- Real AI generation of recommendations (surface is stubbed with realistic mocks).
