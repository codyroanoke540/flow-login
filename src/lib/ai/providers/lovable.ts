import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";

import type { ChatProvider, StreamArgs } from "./types";

/**
 * Lovable AI Gateway provider (OpenAI-compatible).
 * Default model can be changed here without touching call sites.
 */
export function createLovableProvider(apiKey: string): ChatProvider {
  const gateway = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });

  return {
    name: "lovable",
    defaultModel: "google/gemini-3.5-flash",
    streamResponse({ messages, system, model, tools }: StreamArgs) {
      const result = streamText({
        model: gateway(model ?? "google/gemini-3.5-flash"),
        system,
        messages,
        tools,
      });
      return result.toTextStreamResponse();
    },
  };
}