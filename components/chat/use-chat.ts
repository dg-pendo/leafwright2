"use client";

import { useCallback, useRef, useState } from "react";
import { trackAgentEvent } from "@/lib/analytics";
import { CONVERSATION_HEADER, MESSAGE_HEADER, MODEL_HEADER } from "@/lib/chat/conversation";
import { SUGGESTED_PROMPTS } from "@/lib/chat/prompts";
import type { Persona } from "@/lib/db/schema";

export type ChatStatus = "idle" | "streaming" | "error";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  rating?: "up" | "down";
  failed?: boolean;
}

/** The id each persona's assistant is reported under in conversation analytics. */
const AGENT_IDS: Record<Persona, string> = {
  shopper: "EqnBn3dm4ura7jofA_6P8mjwi8c",
  merchant: "ctKfJJwfDYKN-Uf2mbk_EdhSN8w",
};

function localId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function useChat(persona: Persona) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const conversationId = useRef<string | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);
  const recordedPrompts = useRef(new Set<string>());

  const send = useCallback(
    async (history: UiMessage[]) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setStatus("streaming");
      const pendingId = localId("pending");
      setMessages([...history, { id: pendingId, role: "assistant", content: "" }]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: conversationId.current,
            persona,
            messages: history.map(({ id, role, content }) => ({ id, role, content })),
          }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body)
          throw new Error(`Chat request failed (${response.status})`);

        conversationId.current =
          response.headers.get(CONVERSATION_HEADER) ?? conversationId.current;
        const assistantId = response.headers.get(MESSAGE_HEADER) ?? pendingId;
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingId ? { ...message, id: assistantId } : message,
          ),
        );

        // The server assigns the conversation id, so a prompt is recorded once it is accepted.
        // A retry re-sends the same prompt, which is only recorded the first time.
        const prompt = [...history].reverse().find((message) => message.role === "user");
        if (prompt && conversationId.current && !recordedPrompts.current.has(prompt.id)) {
          recordedPrompts.current.add(prompt.id);
          trackAgentEvent("prompt", {
            agentId: AGENT_IDS[persona],
            conversationId: conversationId.current,
            messageId: prompt.id,
            content: prompt.content,
            suggestedPrompt: SUGGESTED_PROMPTS[persona].includes(prompt.content),
          });
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let text = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          const snapshot = text;
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId ? { ...message, content: snapshot } : message,
            ),
          );
        }
        setStatus("idle");
        if (conversationId.current) {
          trackAgentEvent("agent_response", {
            agentId: AGENT_IDS[persona],
            conversationId: conversationId.current,
            messageId: assistantId,
            content: text,
            modelUsed: response.headers.get(MODEL_HEADER) ?? undefined,
          });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingId || (message.role === "assistant" && message.content === "")
              ? { ...message, content: "Something went wrong. Try again?", failed: true }
              : message,
          ),
        );
        setStatus("error");
      }
    },
    [persona],
  );

  const submit = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || status === "streaming") return;
      setInput("");
      const history = [...messages, { id: localId("msg"), role: "user" as const, content }];
      await send(history);
    },
    [input, messages, send, status],
  );

  const retry = useCallback(
    async (messageId: string) => {
      const index = messages.findIndex((message) => message.id === messageId);
      if (index === -1) return;
      const history = messages.slice(0, index).filter((message) => !message.failed);
      if (!history.some((message) => message.role === "user")) return;
      // A failed message is a local placeholder, not a reply the assistant sent.
      if (conversationId.current && !messages[index].failed) {
        trackAgentEvent("user_reaction", {
          agentId: AGENT_IDS[persona],
          conversationId: conversationId.current,
          messageId,
          content: "retry",
        });
      }
      await send(history);
    },
    [messages, persona, send],
  );

  const rate = useCallback(
    async (messageId: string, value: "up" | "down") => {
      if (!conversationId.current) return;
      const rated = messages.find((message) => message.id === messageId);
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, rating: value } : message,
        ),
      );
      // Clicking the rating a reply already has changes nothing, so it is not recorded again.
      if (rated && !rated.failed && rated.rating !== value) {
        trackAgentEvent("user_reaction", {
          agentId: AGENT_IDS[persona],
          conversationId: conversationId.current,
          messageId,
          content: value === "up" ? "positive" : "negative",
        });
      }
      await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversationId.current, messageId, value }),
      }).catch((error) => console.error(error));
    },
    [messages, persona],
  );

  return { messages, input, setInput, status, submit, rate, retry };
}
