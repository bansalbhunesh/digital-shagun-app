import { Router } from "express";
import { db, transactionsTable, eventsTable, relationshipLedgerTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { validateRequest } from "../middlewares/validate";
import { SendShagunBody } from "@workspace/api-zod";

const router = Router();

import { generateId } from "../utils/id";
const REVEAL_DELAY_MINUTES = 10;

router.post("/", requireAuth, validateRequest(SendShagunBody), async (req, res) => {
  const { eventId, senderId, senderName, receiverId, receiverName, amount, message } = req.body;
  
  if (req.user?.id !== senderId) {
    return res.status(403).json({ error: "Forbidden: You cannot send shagun on behalf of another user." });
  }

  const resolvedEventId = eventId || "direct";

  const id = generateId();
  const revealAt = new Date(Date.now() + REVEAL_DELAY_MINUTES * 60 * 1000);

  const [tx] = await db.insert(transactionsTable).values({
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

  // Update relationship ledger — pass receiverName so it shows in ledger
  await updateLedger(senderId, senderName, receiverId, "sent", amount, resolvedEventId, receiverName);
  await updateLedger(receiverId, "", senderId, "received", amount, resolvedEventId, senderName);

  // For non-direct sends, update ledger with event name
  if (resolvedEventId !== "direct") {
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, resolvedEventId)).limit(1);
    if (event) {
      await db.update(relationshipLedgerTable)
        .set({ lastEventName: event.title, lastEventDate: event.date })
        .where(and(
          eq(relationshipLedgerTable.userId, senderId),
          eq(relationshipLedgerTable.contactId, receiverId)
        ));
    }
  } else {
    // For direct sends, mark the occasion in ledger
    await db.update(relationshipLedgerTable)
      .set({ lastEventName: "Direct Shagun" })
      .where(and(
        eq(relationshipLedgerTable.userId, senderId),
        eq(relationshipLedgerTable.contactId, receiverId)
      ));
  }

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

async function updateLedger(userId: string, userName: string, contactId: string, direction: "sent" | "received", amount: number, eventId: string, contactName?: string) {
  const existing = await db.select().from(relationshipLedgerTable)
    .where(and(
      eq(relationshipLedgerTable.userId, userId),
      eq(relationshipLedgerTable.contactId, contactId)
    )).limit(1);

  if (existing.length > 0) {
    const curr = existing[0];
    const updates: Record<string, string> = {};
    if (direction === "sent") {
      updates.totalGiven = (parseFloat(curr.totalGiven ?? "0") + amount).toString();
    } else {
      updates.totalReceived = (parseFloat(curr.totalReceived ?? "0") + amount).toString();
    }
    // Update contactName if we now have it and it was blank
    if (contactName && (!curr.contactName || curr.contactName === "")) {
      updates.contactName = contactName;
    }
    await db.update(relationshipLedgerTable).set(updates).where(eq(relationshipLedgerTable.id, curr.id));
  } else {
    const id = generateId();
    const resolvedName = contactName || (direction === "received" ? userName : "");
    await db.insert(relationshipLedgerTable).values({
      id,
      userId,
      contactId,
      contactName: resolvedName,
      totalGiven: direction === "sent" ? amount.toString() : "0",
      totalReceived: direction === "received" ? amount.toString() : "0",
    });
  }
}

router.get("/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const txs = await db.select().from(transactionsTable).where(eq(transactionsTable.eventId, eventId));

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

  return res.json(result);
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
