import { pgTable, text, timestamp, numeric, boolean, index } from "drizzle-orm/pg-core";

export const paymentsTable = pgTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().unique(),
  paymentId: text("payment_id"),
  userId: text("user_id").notNull(),
  receiverId: text("receiver_id").notNull(),
  eventId: text("event_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  signature: text("signature"),
  webhookVerified: boolean("webhook_verified").notNull().default(false),
  transactionId: text("transaction_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  capturedAt: timestamp("captured_at"),
}, (table) => [
  index("pay_user_id_idx").on(table.userId),
  index("pay_order_id_idx").on(table.orderId),
  index("pay_status_idx").on(table.status),
]);

export type Payment = typeof paymentsTable.$inferSelect;
