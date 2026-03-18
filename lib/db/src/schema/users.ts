import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const INDIA_REGIONS = ["north", "south", "east", "west"] as const;
export type IndiaRegion = typeof INDIA_REGIONS[number];

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  avatarColor: text("avatar_color").notNull().default("#8B0000"),
  region: text("region"),   // IndiaRegion | null — drives AI regional multiplier
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
