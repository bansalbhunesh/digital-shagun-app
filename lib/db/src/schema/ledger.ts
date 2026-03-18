import { pgTable, text, timestamp, numeric, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const relationshipLedgerTable = pgTable("relationship_ledger", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  contactId: text("contact_id").notNull(),
  contactName: text("contact_name").notNull(),
  totalGiven: numeric("total_given", { precision: 12, scale: 2 }).notNull().default("0"),
  totalReceived: numeric("total_received", { precision: 12, scale: 2 }).notNull().default("0"),
  lastEventName: text("last_event_name"),
  lastEventDate: text("last_event_date"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("ledger_user_contact_uidx").on(table.userId, table.contactId),
  index("ledger_user_id_idx").on(table.userId),
  index("ledger_contact_id_idx").on(table.contactId),
]);

export const insertLedgerSchema = createInsertSchema(relationshipLedgerTable);
export type InsertLedger = z.infer<typeof insertLedgerSchema>;
export type RelationshipLedger = typeof relationshipLedgerTable.$inferSelect;
