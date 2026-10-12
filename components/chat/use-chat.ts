"use client";

import { useCallback, useRef, useState } from "react";
import { CONVERSATION_HEADER, MESSAGE_HEADER, PROVIDER_HEADER } from "@/lib/chat/conversation";
import { SUGGESTED_PROMPTS } from "@/lib/chat/prompts";
import type { Persona } from "@/lib/db/schema";
import { pendo } from "@/lib/pendo/client";

export type ChatStatus = "idle" | "streaming" | "error";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  rating?: "up" | "down";
  failed?: boolean;
  /** Which provider wrote an assistant reply. */
  provider?: string;
}

interface SendOptions {
  /** Position of the suggested prompt that was clicked; -1 for a typed message. */
  suggestionIndex?: number;
  isRetry?: boolean;
}

/** Conversations and replies already recorded, kept outside the hook so remounts cannot repeat them. */
const recordedConversations = new Set<string>();
const recordedReplies = new Set<string>();

function localId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/** How many user messages there are, i.e. the number of the turn `messages` ends on. */
function turnNumber(messages: UiMessage[]): number {
  return messages.filter((message) => message.role === "user").length;
}

export function useChat(persona: Persona) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const conversationId = useRef<string | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);

  const send = useCallback(
    async (history: UiMessage[], { suggestionIndex = -1, isRetry = false }: SendOptions = {}) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setStatus("streaming");
      const pendingId = localId("pending");
      setMessages([...history, { id: pendingId, role: "assistant", content: "" }]);
      const startedAt = performance.now();
      const turn = turnNumber(history);
      const isSuggestedPrompt = suggestionIndex >= 0;
      let httpStatus: number | null = null;

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
        httpStatus = response.status;
        if (!response.ok || !response.body)
          throw new Error(`Chat request failed (${response.status})`);

        const previousConversationId = conversationId.current;
        conversationId.current =
          response.headers.get(CONVERSATION_HEADER) ?? conversationId.current;
        const assistantId = response.headers.get(MESSAGE_HEADER) ?? pendingId;
        const provider = response.headers.get(PROVIDER_HEADER);
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingId
              ? { ...message, id: assistantId, provider: provider ?? undefined }
              : message,
          ),
        );

        const startedConversation = conversationId.current;
        if (
          startedConversation &&
          startedConversation !== previousConversationId &&
          !recordedConversations.has(startedConversation)
        ) {
          recordedConversations.add(startedConversation);
          pendo.track("assistant_conversation_started", {
            persona,
            conversationId: startedConversation,
            entryPath: window.location.pathname,
            isSuggestedPrompt,
            suggestionIndex: isSuggestedPrompt ? suggestionIndex : null,
            provider,
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

        if (!recordedReplies.has(assistantId)) {
          recordedReplies.add(assistantId);
          const question = [...history].reverse().find((message) => message.role === "user");
          // Lengths only: what people ask the assistant stays out of the event.
          pendo.track("assistant_message_sent", {
            persona,
            conversationId: conversationId.current ?? null,
            turnNumber: turn,
            isSuggestedPrompt,
            messageLength: question?.content.length ?? 0,
            responseLength: text.length,
            responseTimeMs: Math.round(performance.now() - startedAt),
            provider,
            isRetry,
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
        pendo.track("assistant_response_failed", {
          persona,
          conversationId: conversationId.current ?? null,
          httpStatus,
          errorMessage: error instanceof Error ? error.message : String(error),
          turnNumber: turn,
        });
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
      // Suggested prompts are submitted with their text; typed messages come from the input.
      const suggestionIndex = text === undefined ? -1 : SUGGESTED_PROMPTS[persona].indexOf(text);
      await send(history, { suggestionIndex });
    },
    [input, messages, persona, send, status],
  );

  const retry = useCallback(
    async (messageId: string) => {
      const index = messages.findIndex((message) => message.id === messageId);
      if (index === -1) return;
      const history = messages.slice(0, index).filter((message) => !message.failed);
      if (!history.some((message) => message.role === "user")) return;
      const retried = messages[index];
      pendo.track("assistant_response_retried", {
        persona,
        conversationId: conversationId.current ?? null,
        messageId,
        wasFailed: Boolean(retried.failed),
        previousRating: retried.rating ?? null,
        turnNumber: turnNumber(history),
      });
      await send(history, { isRetry: true });
    },
    [messages, persona, send],
  );

  const rate = useCallback(
    async (messageId: string, value: "up" | "down") => {
      const conversation = conversationId.current;
      if (!conversation) return;
      const index = messages.findIndex((message) => message.id === messageId);
      const rated = index === -1 ? undefined : messages[index];
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, rating: value } : message,
        ),
      );
      const response = await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversation, messageId, value }),
      }).catch((error: unknown) => {
        console.error(error);
        return null;
      });
      // Clicking the rating a reply already has changes nothing, so it is not counted again.
      if (!response?.ok || !rated || rated.rating === value) return;
      pendo.track("assistant_response_rated", {
        persona,
        conversationId: conversation,
        messageId,
        rating: value,
        previousRating: rated.rating ?? null,
        turnNumber: turnNumber(messages.slice(0, index)),
        provider: rated.provider ?? null,
      });
    },
    [messages, persona],
  );

  return { messages, input, setInput, status, submit, rate, retry };
}
