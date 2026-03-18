/**
 * Ledger Reconciliation Job
 *
 * Computes the ground truth for every (userId, contactId) pair directly
 * from the transactions table, then patches any ledger rows whose totals
 * have drifted.  Runs on server start and every 6 hours.
 */

import { db, transactionsTable, relationshipLedgerTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import logger from "../lib/logger";

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export async function runLedgerReconciliation(): Promise<void> {
  const started = Date.now();
  logger.info("Ledger reconciliation started");

  let checked = 0;
  let fixed = 0;
  let created = 0;

  try {
    // ── Step 1: Aggregate sent totals from transactions ────────────────────
    // For each (senderId, receiverId) pair, sum all amounts sent
    const sentRows = await db
      .select({
        userId: transactionsTable.senderId,
        contactId: transactionsTable.receiverId,
        total: sql<string>`SUM(${transactionsTable.amount}::numeric)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactionsTable)
      .groupBy(transactionsTable.senderId, transactionsTable.receiverId);

    // ── Step 2: Aggregate received totals from transactions ────────────────
    const receivedRows = await db
      .select({
        userId: transactionsTable.receiverId,
        contactId: transactionsTable.senderId,
        total: sql<string>`SUM(${transactionsTable.amount}::numeric)`,
      })
      .from(transactionsTable)
      .groupBy(transactionsTable.receiverId, transactionsTable.senderId);

    // Build maps: "userId:contactId" → correct value
    const sentMap = new Map<string, number>();
    for (const row of sentRows) {
      sentMap.set(`${row.userId}:${row.contactId}`, parseFloat(row.total ?? "0"));
    }

    const receivedMap = new Map<string, number>();
    for (const row of receivedRows) {
      receivedMap.set(`${row.userId}:${row.contactId}`, parseFloat(row.total ?? "0"));
    }

    // ── Step 3: Load all current ledger rows ───────────────────────────────
    const ledgerRows = await db.select().from(relationshipLedgerTable);
    const ledgerIndex = new Map<string, typeof ledgerRows[0]>();
    for (const row of ledgerRows) {
      ledgerIndex.set(`${row.userId}:${row.contactId}`, row);
    }

    // ── Step 4: All unique pairs from transactions ─────────────────────────
    const allPairs = new Set<string>([...sentMap.keys(), ...receivedMap.keys()]);

    for (const pairKey of allPairs) {
      const [userId, contactId] = pairKey.split(":");
      const correctGiven = sentMap.get(pairKey) ?? 0;
      const correctReceived = receivedMap.get(pairKey) ?? 0;

      checked++;
      const ledgerRow = ledgerIndex.get(pairKey);

      if (!ledgerRow) {
        // Missing ledger row — create it
        await db.insert(relationshipLedgerTable).values({
          id: generateId(),
          userId,
          contactId,
          contactName: "",
          totalGiven: correctGiven.toString(),
          totalReceived: correctReceived.toString(),
        }).onConflictDoNothing();
        created++;
        logger.warn("Reconciliation: created missing ledger row", { userId, contactId, correctGiven, correctReceived });
        continue;
      }

      const currentGiven = parseFloat(ledgerRow.totalGiven ?? "0");
      const currentReceived = parseFloat(ledgerRow.totalReceived ?? "0");

      // Allow tiny floating-point drift (< 1 paisa)
      const givenDrift = Math.abs(currentGiven - correctGiven);
      const receivedDrift = Math.abs(currentReceived - correctReceived);

      if (givenDrift > 0.01 || receivedDrift > 0.01) {
        await db.update(relationshipLedgerTable)
          .set({
            totalGiven: correctGiven.toString(),
            totalReceived: correctReceived.toString(),
          })
          .where(eq(relationshipLedgerTable.id, ledgerRow.id));

        fixed++;
        logger.warn("Reconciliation: fixed ledger mismatch", {
          userId,
          contactId,
          givenBefore: currentGiven,
          givenAfter: correctGiven,
          receivedBefore: currentReceived,
          receivedAfter: correctReceived,
        });
      }
    }

    const ms = Date.now() - started;
    logger.info("Ledger reconciliation complete", { checked, fixed, created, ms });
  } catch (err: any) {
    logger.error("Ledger reconciliation failed", { error: err.message });
  }
}

const SIX_HOURS = 6 * 60 * 60 * 1000;

export function startReconciliationJob(): void {
  // Run immediately on startup (after a short delay so DB is ready)
  setTimeout(() => {
    runLedgerReconciliation().catch(() => {});
  }, 5000);

  // Then every 6 hours
  setInterval(() => {
    runLedgerReconciliation().catch(() => {});
  }, SIX_HOURS);

  logger.info("Ledger reconciliation job scheduled (startup + every 6h)");
}
