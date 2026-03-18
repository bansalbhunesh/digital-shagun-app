import { Router } from "express";
import { db, transactionsTable, eventsTable, relationshipLedgerTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import logger from "../lib/logger";

const router = Router();

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const REVEAL_DELAY_MINUTES = 10;
const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

// POST /api/shagun — record a shagun transaction (JWT-protected, senderId from token)
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const senderId = req.userId!;
  const { eventId, senderName, receiverId, receiverName, amount, message } = req.body;

  if (!senderName || typeof senderName !== "string") return res.status(400).json({ error: "senderName is required" });
  if (!receiverId || typeof receiverId !== "string") return res.status(400).json({ error: "receiverId is required" });
  if (!amount || typeof amount !== "number" || amount < 1 || amount > 10000000) return res.status(400).json({ error: "amount must be a number between 1 and 10,000,000" });
  if (message && typeof message === "string" && message.length > 500) return res.status(400).json({ error: "Message must be under 500 characters" });

  const resolvedEventId = eventId || "direct";
  const id = generateId();
  const revealAt = new Date(Date.now() + REVEAL_DELAY_MINUTES * 60 * 1000);

  let tx: any;
  try {
    await db.transaction(async (dbTx) => {
      const [inserted] = await dbTx.insert(transactionsTable).values({
        id,
        eventId: resolvedEventId,
        senderId,
        senderName,
        receiverId,
        amount: amount.toString(),
        message: message ?? null,
        isRevealed: "false",
        revealAt,
      }).returning();
      tx = inserted;

      await upsertLedger(dbTx, senderId, senderName, receiverId, "sent", amount, resolvedEventId, receiverName);
      await upsertLedger(dbTx, receiverId, "", senderId, "received", amount, resolvedEventId, senderName);

      if (resolvedEventId !== "direct") {
        const [event] = await dbTx.select().from(eventsTable).where(eq(eventsTable.id, resolvedEventId)).limit(1);
        if (event) {
          await dbTx.update(relationshipLedgerTable)
            .set({ lastEventName: event.title, lastEventDate: event.date })
            .where(and(eq(relationshipLedgerTable.userId, senderId), eq(relationshipLedgerTable.contactId, receiverId)));
        }
      } else {
        await dbTx.update(relationshipLedgerTable)
          .set({ lastEventName: "Direct Shagun" })
          .where(and(eq(relationshipLedgerTable.userId, senderId), eq(relationshipLedgerTable.contactId, receiverId)));
      }
    });
  } catch (err: any) {
    logger.error("shagun POST transaction failed", { error: err.message, senderId, receiverId });
    return res.status(500).json({ error: "Failed to record shagun. Please try again." });
  }

  logger.info("shagun sent", { id: tx.id, senderId, receiverId, amount, eventId: resolvedEventId });

  return res.status(201).json({
    id: tx.id,
    eventId: tx.eventId,
    senderId: tx.senderId,
    senderName: tx.senderName,
    receiverId: tx.receiverId,
    amount: parseFloat(tx.amount),
    message: tx.message ?? null,
    isRevealed: tx.isRevealed === "true",
    revealAt: tx.revealAt.toISOString(),
    createdAt: tx.createdAt.toISOString(),
  });
});

async function upsertLedger(
  dbTx: any,
  userId: string,
  userName: string,
  contactId: string,
  direction: "sent" | "received",
  amount: number,
  _eventId: string,
  contactName?: string,
) {
  const existing = await dbTx.select().from(relationshipLedgerTable)
    .where(and(eq(relationshipLedgerTable.userId, userId), eq(relationshipLedgerTable.contactId, contactId)))
    .limit(1);

  if (existing.length > 0) {
    const curr = existing[0];
    const updates: Record<string, string> = {};
    if (direction === "sent") {
      updates.totalGiven = (parseFloat(curr.totalGiven ?? "0") + amount).toString();
    } else {
      updates.totalReceived = (parseFloat(curr.totalReceived ?? "0") + amount).toString();
    }
    if (contactName && (!curr.contactName || curr.contactName === "")) {
      updates.contactName = contactName;
    }
    await dbTx.update(relationshipLedgerTable).set(updates).where(eq(relationshipLedgerTable.id, curr.id));
  } else {
    const ledgerId = generateId();
    const resolvedName = contactName || (direction === "received" ? userName : "");
    await dbTx.insert(relationshipLedgerTable).values({
      id: ledgerId,
      userId,
      contactId,
      contactName: resolvedName,
      totalGiven: direction === "sent" ? amount.toString() : "0",
      totalReceived: direction === "received" ? amount.toString() : "0",
    });
  }
}

// GET /api/shagun/:eventId?page=1&limit=20
router.get("/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(req.query.limit as string) || DEFAULT_PAGE_LIMIT));
  const offset = (page - 1) * limit;

  const txs = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.eventId, eventId))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const now = new Date();
  const result = [];
  for (const t of txs) {
    const shouldReveal = t.revealAt <= now;
    if (shouldReveal && t.isRevealed !== "true") {
      await db.update(transactionsTable).set({ isRevealed: "true" }).where(eq(transactionsTable.id, t.id));
    }
    result.push({
      id: t.id,
      eventId: t.eventId,
      senderId: t.senderId,
      senderName: t.senderName,
      receiverId: t.receiverId,
      amount: parseFloat(t.amount),
      message: t.message ?? null,
      isRevealed: shouldReveal || t.isRevealed === "true",
      revealAt: t.revealAt instanceof Date ? t.revealAt.toISOString() : t.revealAt,
      createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
    });
  }

  return res.json({ data: result, page, limit, hasMore: result.length === limit });
});

router.get("/reveal/:transactionId", async (req, res) => {
  const { transactionId } = req.params;
  const [t] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, transactionId)).limit(1);
  if (!t) return res.status(404).json({ error: "Transaction not found" });

  const now = new Date();
  const revealAt = t.revealAt instanceof Date ? t.revealAt : new Date(t.revealAt);
  const isRevealed = now >= revealAt || t.isRevealed === "true";
  const secondsRemaining = isRevealed ? 0 : Math.ceil((revealAt.getTime() - now.getTime()) / 1000);

  if (isRevealed && t.isRevealed !== "true") {
    await db.update(transactionsTable).set({ isRevealed: "true" }).where(eq(transactionsTable.id, t.id));
  }

  return res.json({
    id: t.id,
    isRevealed,
    amount: parseFloat(t.amount),
    senderName: t.senderName,
    message: t.message ?? null,
    secondsRemaining,
  });
});

export default router;
