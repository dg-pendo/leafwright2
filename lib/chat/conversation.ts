import { z } from "zod";
import { ChatRoleSchema, PersonaSchema } from "@/lib/db/schema";

export const ChatRequestSchema = z.object({
  conversationId: z.string().min(1).optional(),
  persona: PersonaSchema,
  messages: z
    .array(
      z.object({
        id: z.string().min(1).optional(),
        role: ChatRoleSchema,
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
});
export type ChatRequestBody = z.infer<typeof ChatRequestSchema>;

export const FeedbackSchema = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
  value: z.enum(["up", "down"]),
});
export type FeedbackBody = z.infer<typeof FeedbackSchema>;

/** Response headers the client reads to map the streamed reply back to stored records. */
export const CONVERSATION_HEADER = "x-conversation-id";
export const MESSAGE_HEADER = "x-message-id";
