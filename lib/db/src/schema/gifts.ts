import { pgTable, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventGiftsTable = pgTable("event_gifts", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  currentAmount: numeric("current_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  imageEmoji: text("image_emoji").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const giftContributionsTable = pgTable("gift_contributions", {
  id: text("id").primaryKey(),
  giftId: text("gift_id").notNull(),
  eventId: text("event_id").notNull(),
  contributorId: text("contributor_id").notNull(),
  contributorName: text("contributor_name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEventGiftSchema = createInsertSchema(eventGiftsTable);
export const insertGiftContributionSchema = createInsertSchema(giftContributionsTable);
export type InsertEventGift = z.infer<typeof insertEventGiftSchema>;
export type EventGift = typeof eventGiftsTable.$inferSelect;
export type GiftContribution = typeof giftContributionsTable.$inferSelect;
