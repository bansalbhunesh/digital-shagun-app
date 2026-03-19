import { Router } from "express";
import { db, relationshipLedgerTable, transactionsTable, eventsTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";

const router = Router();

function suggestAmount(totalGiven: number): number {
  if (totalGiven <= 0) return 501;
  const shagunAmounts = [101, 251, 501, 1001, 1100, 2100, 5001];
  const next = shagunAmounts.find(a => a > totalGiven);
  return next ?? Math.ceil(totalGiven / 100) * 100 + 100;
}

router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  const page = parseInt((req.query.page as string) ?? "0");
  const limitValue = parseInt((req.query.limit as string) ?? "20");

  const entries = await db.select().from(relationshipLedgerTable)
    .where(eq(relationshipLedgerTable.userId, userId))
    .limit(limitValue)
    .offset(page * limitValue);

  const result = entries.map(e => ({
    contactId: e.contactId,
    contactName: e.contactName,
    totalGiven: parseFloat(e.totalGiven ?? "0"),
    totalReceived: parseFloat(e.totalReceived ?? "0"),
    balance: parseFloat(e.totalGiven ?? "0") - parseFloat(e.totalReceived ?? "0"),
    lastEventName: e.lastEventName ?? null,
    lastEventDate: e.lastEventDate ?? null,
    suggestedAmount: suggestAmount(parseFloat(e.totalReceived ?? "0")),
    transactionCount: 1,
  }));

  return res.json({
    data: result,
    nextCursor: entries.length === limitValue ? page + 1 : null,
  });
});

router.get("/:userId/:contactId", async (req, res) => {
  const { userId, contactId } = req.params;

  const [entry] = await db.select().from(relationshipLedgerTable)
    .where(and(
      eq(relationshipLedgerTable.userId, userId),
      eq(relationshipLedgerTable.contactId, contactId)
    )).limit(1);

  const txs = await db.select().from(transactionsTable)
    .where(or(
      and(eq(transactionsTable.senderId, userId), eq(transactionsTable.receiverId, contactId)),
      and(eq(transactionsTable.senderId, contactId), eq(transactionsTable.receiverId, userId))
    ));

  const transactions = await Promise.all(txs.map(async t => {
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, t.eventId)).limit(1);
    return {
      id: t.id,
      direction: t.senderId === userId ? "given" as const : "received" as const,
      amount: parseFloat(t.amount),
      eventName: event?.title ?? "Unknown Event",
      eventType: event?.type ?? "wedding",
      date: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
      message: t.message ?? null,
    };
  }));

  const totalGiven = parseFloat(entry?.totalGiven ?? "0");
  const totalReceived = parseFloat(entry?.totalReceived ?? "0");

  return res.json({
    contactId,
    contactName: entry?.contactName ?? contactId,
    totalGiven,
    totalReceived,
    balance: totalGiven - totalReceived,
    suggestedAmount: suggestAmount(totalReceived),
    transactions,
  });
});

export default router;
