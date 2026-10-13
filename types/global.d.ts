import type { VisitorIdentity } from "@/lib/auth/identity";

export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** One assistant conversation event: a prompt, a reply, or a reaction to a reply. */
export interface AgentEventMetadata {
  agentId: string;
  conversationId: string;
  messageId: string;
  /** The message text, or the reaction ("positive", "negative", "retry", …) for reactions. */
  content: string;
  modelUsed?: string;
  suggestedPrompt?: boolean;
  toolsUsed?: string[];
  fileUploaded?: boolean;
}

declare global {
  /**
   * Defined by the inline script in the root layout, which queues calls until the agent script
   * loads. `clearSession` and `trackAgent` are only available once it has loaded.
   */
  var pendo:
    | {
        identify: (identity: VisitorIdentity) => void;
        trackAgent?: (eventType: AgentEventType, metadata: AgentEventMetadata) => void;
        clearSession?: () => void;
      }
    | undefined;
}
