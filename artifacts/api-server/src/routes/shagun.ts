import { Router } from "express";
import {
  db,
  transactionsTable,
  eventsTable,
  relationshipLedgerTable,
  eventGuestsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { validateRequest } from "../middlewares/validate";
import { SendShagunBody } from "@workspace/api-zod";
import logger from "../lib/logger";

const router = Router();

import { generateId } from "../utils/id";
const REVEAL_DELAY_MINUTES = 10;

router.post("/", requireAuth, validateRequest(SendShagunBody), async (req, res) => {
  const { eventId, receiverId, receiverName, amount, message, requestId } = req.body;
  const senderId = req.user!.id;
  const senderName = req.user!.name;

  // Idempotency Check: Skip if requestId already exists
  if (requestId) {
    const [existing] = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.requestId, requestId))
      .limit(1);
    if (existing) {
      return res.status(200).json({
        id: existing.id,
        eventId: existing.eventId,
        senderId: existing.senderId,
        senderName: existing.senderName,
        receiverId: existing.receiverId,
        amount: parseFloat(existing.amount),
        message: existing.message ?? null,
        isRevealed: existing.isRevealed === "true",
        revealAt: existing.revealAt.toISOString(),
        createdAt: existing.createdAt.toISOString(),
        _idempotent: true,
      });
    }
  }

  const resolvedEventId = eventId || "direct";

  const id = generateId();
  const revealAt = new Date(Date.now() + REVEAL_DELAY_MINUTES * 60 * 1000);

  const tx = await db.transaction(async (tx) => {
    const [transaction] = await tx
      .insert(transactionsTable)
      .values({
        id,
        eventId: resolvedEventId,
        senderId,
        senderName,
        receiverId,
        amount: amount.toString(),
        message: message ?? null,
        isRevealed: "false",
        revealAt,
        requestId: requestId ?? null,
      })
      .returning();

    // Update relationship ledger — pass receiverName so it shows in ledger
    await updateLedgerInTransaction(
      tx,
      senderId,
      senderName,
      receiverId,
      "sent",
      amount,
      receiverName
    );
    await updateLedgerInTransaction(tx, receiverId, "", senderId, "received", amount, senderName);

    // For non-direct sends, update ledger with event name
    if (resolvedEventId !== "direct") {
      const [event] = await tx
        .select()
        .from(eventsTable)
        .where(eq(eventsTable.id, resolvedEventId))
        .limit(1);
      if (event) {
        await tx
          .update(relationshipLedgerTable)
          .set({ lastEventName: event.title, lastEventDate: event.date })
          .where(
            and(
              eq(relationshipLedgerTable.userId, senderId),
              eq(relationshipLedgerTable.contactId, receiverId)
            )
          );
      }
    } else {
      // For direct sends, mark the occasion in ledger
      await tx
        .update(relationshipLedgerTable)
        .set({ lastEventName: "Direct Shagun" })
        .where(
          and(
            eq(relationshipLedgerTable.userId, senderId),
            eq(relationshipLedgerTable.contactId, receiverId)
          )
        );
    }

    logger.info(
      {
        type: "SHAGUN_TRANSACTION",
        transactionId: transaction.id,
        senderId: transaction.senderId,
        receiverId: transaction.receiverId,
        amount: transaction.amount,
        eventId: transaction.eventId,
      },
      "Shagun transaction created"
    );

    return transaction;
  });

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

export async function updateLedgerInTransaction(
  tx: any,
  userId: string,
  userName: string,
  contactId: string,
  direction: "sent" | "received",
  amount: number,
  contactName?: string
) {
  const existing = await tx
    .select()
    .from(relationshipLedgerTable)
    .where(
      and(
        eq(relationshipLedgerTable.userId, userId),
        eq(relationshipLedgerTable.contactId, contactId)
      )
    )
    .limit(1);

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
    await tx
      .update(relationshipLedgerTable)
      .set(updates)
      .where(eq(relationshipLedgerTable.id, curr.id));
  } else {
    const id = generateId();
    const resolvedName = contactName || (direction === "received" ? userName : "");
    await tx.insert(relationshipLedgerTable).values({
      id,
      userId,
      contactId,
      contactName: resolvedName,
      totalGiven: direction === "sent" ? amount.toString() : "0",
      totalReceived: direction === "received" ? amount.toString() : "0",
    });
  }
}

router.get("/:eventId", requireAuth, async (req, res) => {
  const { eventId } = req.params;
  const currentUserId = req.user!.id;

  // Authorization check: Only host or guest should see event-specific shagun history
  const [event] = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.id, eventId as string))
    .limit(1);
  if (!event) return res.status(404).json({ error: "Event not found" });

  const isHost = event.hostId === currentUserId;
  // Correct check for guest: eventGuestsTable
  const guests = await db
    .select()
    .from(eventGuestsTable)
    .where(
      and(
        eq(eventGuestsTable.eventId, eventId as string),
        eq(eventGuestsTable.userId, currentUserId)
      )
    )
    .limit(1);
  const isGuest = guests.length > 0;

  if (!isHost && !isGuest) {
    return res.status(403).json({
      error: "Unauthorized: You must be the host or a guest of this event to view shagun history",
    });
  }

  const txs = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.eventId, eventId as string));

  const now = new Date();
  const result = [];
  for (const t of txs) {
    const shouldReveal = t.revealAt <= now;
    // NOTE: Keep side effects for now as requested to fix primary issues first,
    // but moved to background job consideration in plan.
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

router.get("/reveal/:transactionId", requireAuth, async (req, res) => {
  const viewerId = req.user!.id;
  const { transactionId } = req.params;
  const [t] = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.id, transactionId as string))
    .limit(1);

  if (!t) return res.status(404).json({ error: "Transaction not found" });

  const isParticipant = t.senderId === viewerId || t.receiverId === viewerId;
  if (!isParticipant)
    return res
      .status(403)
      .json({ error: "Forbidden: You are not a participant in this transaction." });

  const now = new Date();
  const revealAt = t.revealAt instanceof Date ? t.revealAt : new Date(t.revealAt);
  const isRevealed = now >= revealAt || t.isRevealed === "true";
  const secondsRemaining = isRevealed ? 0 : Math.ceil((revealAt.getTime() - now.getTime()) / 1000);

  return res.json({
    id: t.id,
    isRevealed,
    amount: isRevealed ? parseFloat(t.amount) : 0,
    senderName: t.senderName,
    message: isRevealed ? (t.message ?? null) : undefined,
    secondsRemaining,
  });
});

// Public endpoint for sharing shagun reveal pages (e.g. via WhatsApp)
router.get("/public/:transactionId", async (req, res) => {
  const { transactionId } = req.params;
  const [t] = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.id, transactionId as string))
    .limit(1);

  if (!t) return res.status(404).json({ error: "Certificate not found" });

  const now = new Date();
  const revealAt = t.revealAt instanceof Date ? t.revealAt : new Date(t.revealAt);
  const isRevealed = now >= revealAt || t.isRevealed === "true";

  return res.json({
    id: t.id,
    isRevealed,
    senderName: t.senderName,
    receiverId: t.receiverId,
    amount: isRevealed ? parseFloat(t.amount) : null,
    message: isRevealed ? (t.message ?? null) : null,
    revealAt: revealAt.toISOString(),
    secondsRemaining: isRevealed ? 0 : Math.ceil((revealAt.getTime() - now.getTime()) / 1000),
  });
});

export default router;
