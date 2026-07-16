import { createLovableProvider } from "./lovable";
import type { ChatProvider } from "./types";

export type ProviderName = "lovable" | "openai" | "anthropic" | "google" | "copilot" | "viktor";

/**
 * Provider registry. Add new AI vendors here — call sites never change.
 * Every provider must implement the ChatProvider contract.
 */
export function getProvider(name: ProviderName = "lovable"): ChatProvider {
  switch (name) {
    case "lovable":
    // Aliased: OpenAI models are served through Lovable AI Gateway today.
    case "openai":
    case "anthropic":
    case "google": {
      const key = process.env.LOVABLE_API_KEY;
      if (!key) throw new Error("LOVABLE_API_KEY is not configured");
      return createLovableProvider(key);
    }
    case "copilot":
    case "viktor":
      throw new Error(`Provider "${name}" is registered but not yet implemented`);
    default:
      throw new Error(`Unknown provider: ${name satisfies never}`);
  }
}

export type { ChatProvider } from "./types";