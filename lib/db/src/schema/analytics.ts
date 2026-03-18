import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analyticsEventsTable = pgTable("analytics_events", {
  id: text("id").primaryKey(),
  userId: text("user_id"),                    // null for anonymous events
  event: text("event").notNull(),             // e.g. "payment_success"
  properties: text("properties"),            // JSON string of extra data
  platform: text("platform"),               // "ios" | "android" | "web"
  appVersion: text("app_version"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("analytics_user_id_idx").on(table.userId),
  index("analytics_event_idx").on(table.event),
  index("analytics_created_at_idx").on(table.createdAt),
]);

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEventsTable);
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
export type AnalyticsEvent = typeof analyticsEventsTable.$inferSelect;
