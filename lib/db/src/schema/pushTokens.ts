import { pgTable, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

export const pushTokensTable = pgTable("push_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  token: text("token").notNull(),              // Expo push token
  platform: text("platform"),                 // "ios" | "android" | "web"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("push_tokens_user_token_uidx").on(table.userId, table.token),
  index("push_tokens_user_id_idx").on(table.userId),
]);

export type PushToken = typeof pushTokensTable.$inferSelect;
