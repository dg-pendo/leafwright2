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
  interface Window {
    /** Present only when the client script is on the page; `trackAgent` once it has loaded. */
    pendo?: {
      trackAgent?: (eventType: AgentEventType, metadata: AgentEventMetadata) => void;
    };
  }
}
