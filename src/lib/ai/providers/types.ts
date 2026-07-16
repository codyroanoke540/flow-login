import type { ModelMessage, ToolSet } from "ai";

export type StreamArgs = {
  messages: ModelMessage[];
  system?: string;
  model?: string;
  tools?: ToolSet;
};

/**
 * Provider-agnostic chat interface. Any AI vendor (OpenAI, Claude, Gemini,
 * Microsoft Copilot, Viktor, ...) plugs in by implementing this contract.
 * The rest of the app never imports a vendor SDK directly.
 */
export interface ChatProvider {
  readonly name: string;
  readonly defaultModel: string;
  /** Return a streaming HTTP Response (text stream) for the given turn. */
  streamResponse(args: StreamArgs): Response;
}