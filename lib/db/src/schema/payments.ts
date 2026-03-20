import { pgTable, text, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentsTable = pgTable(
  "payments",
  {
    id: text("id").primaryKey(), // Internal payment ID or Razorpay Payment ID
    orderId: text("order_id").notNull().unique(), // Razorpay Order ID
    userId: text("user_id").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("INR"),
    status: text("status").notNull().default("created"), // created, captured, failed, refunded
    paymentId: text("payment_id").unique(), // Razorpay Payment ID (filled after capture)
    giftId: text("gift_id"), // If this is for a contribution
    eventId: text("event_id"), // If this is for a shagun
    receiverId: text("receiver_id"), // If this is for a shagun
    message: text("message"), // For shagun
    idempotencyKey: text("idempotency_key").unique(),
    rawPayload: text("raw_payload"), // JSON string of webhook payload
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("payments_user_id_idx").on(table.userId),
    index("payments_order_id_idx").on(table.orderId),
    index("payments_payment_id_idx").on(table.paymentId),
  ]
);

export const insertPaymentSchema = createInsertSchema(paymentsTable);
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
