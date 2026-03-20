import { pgTable, text, timestamp, numeric, index, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod";

export const transactionsTable = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull(),
    senderId: text("sender_id").notNull(),
    senderName: text("sender_name").notNull(),
    receiverId: text("receiver_id").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    message: text("message"),
    isRevealed: text("is_revealed").notNull().default("false"),
    revealAt: timestamp("reveal_at").notNull(),
    requestId: text("request_id"), // Optional: For client-side idempotency
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("tx_event_id_idx").on(table.eventId),
    index("tx_sender_id_idx").on(table.senderId),
    index("tx_receiver_id_idx").on(table.receiverId),
    index("tx_reveal_at_idx").on(table.revealAt),
    uniqueIndex("tx_request_id_uidx").on(table.requestId),
    index("tx_sender_receiver_idx").on(table.senderId, table.receiverId),
  ]
);

export const insertTransactionSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  senderId: z.string(),
  senderName: z.string(),
  receiverId: z.string(),
  amount: z.string(),
  message: z.string().nullable().optional(),
  isRevealed: z.string().default("false"),
  revealAt: z.date(),
  requestId: z.string().nullable().optional(),
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
