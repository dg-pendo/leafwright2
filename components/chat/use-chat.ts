"use client";

import { useCallback, useRef, useState } from "react";
import { CONVERSATION_HEADER, MESSAGE_HEADER } from "@/lib/chat/conversation";
import type { Persona } from "@/lib/db/schema";

export type ChatStatus = "idle" | "streaming" | "error";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  rating?: "up" | "down";
  failed?: boolean;
}

function localId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function useChat(persona: Persona) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const conversationId = useRef<string | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);

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
      await send(history);
    },
    [messages, send],
  );

  const rate = useCallback(async (messageId: string, value: "up" | "down") => {
    if (!conversationId.current) return;
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, rating: value } : message,
      ),
    );
    await fetch("/api/chat/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: conversationId.current, messageId, value }),
    }).catch((error) => console.error(error));
  }, []);

  return { messages, input, setInput, status, submit, rate, retry };
}
