import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
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
});

export const eventGuestsTable = pgTable("event_guests", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  userId: text("user_id").notNull(),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(eventsTable);
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
