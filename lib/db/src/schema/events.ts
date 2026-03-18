import { pgTable, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventsTable = pgTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  hostId: text("host_id").notNull(),
  hostName: text("host_name").notNull(),
  date: text("date").notNull(),
  venue: text("venue"),
  description: text("description"),
  shareCode: text("share_code").notNull().unique(),
  guestCount: integer("guest_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("events_host_id_idx").on(table.hostId),
  index("events_created_at_idx").on(table.createdAt),
]);

export const eventGuestsTable = pgTable("event_guests", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  userId: text("user_id").notNull(),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (table) => [
  index("event_guests_event_id_idx").on(table.eventId),
  index("event_guests_user_id_idx").on(table.userId),
  index("event_guests_composite_idx").on(table.eventId, table.userId),
]);

export const insertEventSchema = createInsertSchema(eventsTable);
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
