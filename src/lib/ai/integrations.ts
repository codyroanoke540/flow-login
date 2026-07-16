/**
 * Integrations catalog. Modular — new integrations plug in here without
 * changing the core application. Real OAuth wiring lands per-integration.
 */

export type IntegrationCategory =
  | "calendar"
  | "messaging"
  | "email"
  | "sms"
  | "payroll"
  | "emr"
  | "crm"
  | "accounting"
  | "mapping"
  | "weather"
  | "ai_provider";

export type Integration = {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  status: "available" | "coming_soon";
};

export const INTEGRATIONS: Integration[] = [
  { id: "google_calendar", name: "Google Calendar", category: "calendar", description: "Two-way calendar sync.", status: "coming_soon" },
  { id: "outlook", name: "Microsoft Outlook", category: "calendar", description: "Outlook + Exchange sync.", status: "coming_soon" },
  { id: "slack", name: "Slack", category: "messaging", description: "Notifications and slash commands.", status: "coming_soon" },
  { id: "teams", name: "Microsoft Teams", category: "messaging", description: "Notifications and briefings.", status: "coming_soon" },
  { id: "email_smtp", name: "Email (SMTP / Resend)", category: "email", description: "Transactional email.", status: "coming_soon" },
  { id: "twilio", name: "Twilio SMS", category: "sms", description: "Client and employee SMS.", status: "coming_soon" },
  { id: "gusto", name: "Gusto", category: "payroll", description: "Payroll sync.", status: "coming_soon" },
  { id: "adp", name: "ADP", category: "payroll", description: "Enterprise payroll.", status: "coming_soon" },
  { id: "emr_generic", name: "EMR / EHR", category: "emr", description: "Clinical documentation.", status: "coming_soon" },
  { id: "salesforce", name: "Salesforce", category: "crm", description: "Customer relationship data.", status: "coming_soon" },
  { id: "hubspot", name: "HubSpot", category: "crm", description: "Customer + marketing data.", status: "coming_soon" },
  { id: "quickbooks", name: "QuickBooks", category: "accounting", description: "Accounting + invoicing.", status: "coming_soon" },
  { id: "mapbox", name: "Mapbox", category: "mapping", description: "Routing and geocoding.", status: "coming_soon" },
  { id: "google_maps", name: "Google Maps", category: "mapping", description: "Routing and traffic.", status: "coming_soon" },
  { id: "openweather", name: "OpenWeather", category: "weather", description: "Weather-aware scheduling.", status: "coming_soon" },
  { id: "openai", name: "OpenAI", category: "ai_provider", description: "Chat and reasoning models.", status: "available" },
  { id: "anthropic", name: "Anthropic Claude", category: "ai_provider", description: "Reasoning and long-context models.", status: "coming_soon" },
  { id: "google_gemini", name: "Google Gemini", category: "ai_provider", description: "Multimodal reasoning.", status: "coming_soon" },
  { id: "copilot", name: "Microsoft Copilot", category: "ai_provider", description: "Enterprise Copilot.", status: "coming_soon" },
  { id: "viktor", name: "Viktor", category: "ai_provider", description: "Specialized ops AI provider.", status: "coming_soon" },
];