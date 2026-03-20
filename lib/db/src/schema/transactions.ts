import { pgTable, text, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("tx_event_id_idx").on(table.eventId),
    index("tx_sender_id_idx").on(table.senderId),
    index("tx_receiver_id_idx").on(table.receiverId),
    index("tx_reveal_at_idx").on(table.revealAt),
    index("tx_sender_receiver_idx").on(table.senderId, table.receiverId),
  ]
);

export const insertTransactionSchema = createInsertSchema(transactionsTable);
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
