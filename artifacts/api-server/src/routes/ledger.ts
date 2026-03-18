import { Router } from "express";
import { db, relationshipLedgerTable, transactionsTable, eventsTable } from "@workspace/db";
import { eq, and, or, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

function suggestAmount(totalGiven: number): number {
  if (totalGiven <= 0) return 501;
  const shagunAmounts = [101, 251, 501, 1001, 1100, 2100, 5001];
  const next = shagunAmounts.find(a => a > totalGiven);
  return next ?? Math.ceil(totalGiven / 100) * 100 + 100;
}

// GET /api/ledger/:userId?page=1&limit=20
// Auth: user can only access their own ledger
router.get("/:userId", requireAuth, async (req: AuthRequest, res) => {
  const { userId } = req.params;

  // Ownership: users can only see their own ledger
  if (req.userId !== userId) {
    return res.status(403).json({ error: "Access denied. You can only view your own ledger." });
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(req.query.limit as string) || DEFAULT_PAGE_LIMIT));
  const offset = (page - 1) * limit;

  const entries = await db.select().from(relationshipLedgerTable)
    .where(eq(relationshipLedgerTable.userId, userId))
    .orderBy(desc(relationshipLedgerTable.totalGiven))
    .limit(limit)
    .offset(offset);

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

  return res.json({ data: result, page, limit, hasMore: result.length === limit });
});

// GET /api/ledger/:userId/:contactId?page=1&limit=20
router.get("/:userId/:contactId", requireAuth, async (req: AuthRequest, res) => {
  const { userId, contactId } = req.params;

  if (req.userId !== userId) {
    return res.status(403).json({ error: "Access denied." });
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(req.query.limit as string) || DEFAULT_PAGE_LIMIT));
  const offset = (page - 1) * limit;

  const [entry] = await db.select().from(relationshipLedgerTable)
    .where(and(
      eq(relationshipLedgerTable.userId, userId),
      eq(relationshipLedgerTable.contactId, contactId)
    )).limit(1);

  const txs = await db.select().from(transactionsTable)
    .where(or(
      and(eq(transactionsTable.senderId, userId), eq(transactionsTable.receiverId, contactId)),
      and(eq(transactionsTable.senderId, contactId), eq(transactionsTable.receiverId, userId))
    ))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const transactions = await Promise.all(txs.map(async t => {
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, t.eventId)).limit(1);
    return {
      id: t.id,
      direction: t.senderId === userId ? "given" as const : "received" as const,
      amount: parseFloat(t.amount),
      eventName: event?.title ?? (t.eventId === "direct" ? "Direct Shagun" : "Unknown Event"),
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
    page,
    limit,
    hasMore: transactions.length === limit,
  });
});

export default router;
