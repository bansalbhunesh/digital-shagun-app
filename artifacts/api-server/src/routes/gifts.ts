import { Router } from "express";
import { db, eventGiftsTable, giftContributionsTable, eventGuestsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendPushToMany } from "../lib/pushNotifications";
import logger from "../lib/logger";

const router = Router();

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// In-memory SSE subscriber registry: eventId → Set of response objects
const sseSubscribers = new Map<string, Set<any>>();

// Notification batcher: avoids storming the event host with one push per contribution.
// Each event accumulates contributions for BATCH_WINDOW_MS then sends one summary.
const BATCH_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
interface PendingBatch { count: number; totalAmount: number; timer: ReturnType<typeof setTimeout>; }
const notificationBatches = new Map<string, PendingBatch>();

function scheduleContributionNotification(
  eventId: string, guestIds: string[], contributorName: string, amount: number, giftName: string,
) {
  const existing = notificationBatches.get(eventId);
  if (existing) {
    clearTimeout(existing.timer);
    existing.count += 1;
    existing.totalAmount += amount;
  }
  const batch: PendingBatch = existing ?? { count: 1, totalAmount: amount, timer: undefined as any };
  batch.timer = setTimeout(() => {
    notificationBatches.delete(eventId);
    const body = batch.count === 1
      ? `${contributorName} contributed ₹${batch.totalAmount.toLocaleString("en-IN")} towards ${giftName}`
      : `${batch.count} people contributed ₹${batch.totalAmount.toLocaleString("en-IN")} towards ${giftName}`;
    sendPushToMany(guestIds, {
      title: "🎁 Gift Update",
      body,
      data: { type: "gift_contribution", eventId, giftId: "" },
    }).catch(() => {});
    logger.info("Batched gift notification sent", { eventId, count: batch.count, totalAmount: batch.totalAmount });
  }, BATCH_WINDOW_MS);
  notificationBatches.set(eventId, batch);
}

function broadcastGiftUpdate(eventId: string, gifts: any[]) {
  const subs = sseSubscribers.get(eventId);
  if (!subs || subs.size === 0) return;
  const payload = `data: ${JSON.stringify({ gifts })}\n\n`;
  for (const res of subs) {
    try { res.write(payload); } catch {}
  }
}

// POST /api/gifts/contribute — contribute to a gift (MUST come before /:eventId)
router.post("/contribute", async (req, res) => {
  const { giftId, contributorId, contributorName, amount } = req.body;

  const [gift] = await db.select().from(eventGiftsTable).where(eq(eventGiftsTable.id, giftId)).limit(1);
  if (!gift) return res.status(404).json({ error: "Gift not found" });

  const prevAmount = parseFloat(gift.currentAmount ?? "0");
  const target = parseFloat(gift.targetAmount);
  const newAmount = Math.min(prevAmount + amount, target);
  const nowFullyFunded = newAmount >= target && prevAmount < target;

  await db.update(eventGiftsTable)
    .set({ currentAmount: newAmount.toString() })
    .where(eq(eventGiftsTable.id, giftId));

  const id = generateId();
  const [contribution] = await db.insert(giftContributionsTable).values({
    id, giftId,
    eventId: gift.eventId,
    contributorId, contributorName,
    amount: amount.toString(),
  }).returning();

  // Broadcast update to SSE subscribers for this event
  const updatedGifts = await db.select().from(eventGiftsTable).where(eq(eventGiftsTable.eventId, gift.eventId));
  broadcastGiftUpdate(gift.eventId, updatedGifts.map(g => ({
    id: g.id,
    name: g.name,
    targetAmount: parseFloat(g.targetAmount),
    currentAmount: parseFloat(g.currentAmount ?? "0"),
    isFullyFunded: parseFloat(g.currentAmount ?? "0") >= parseFloat(g.targetAmount),
  })));

  // Fetch guest list once — used for both notification paths below
  const guestRows = await db.select({ userId: eventGuestsTable.userId })
    .from(eventGuestsTable)
    .where(eq(eventGuestsTable.eventId, gift.eventId));
  const guestIds = guestRows.map(g => g.userId).filter(id => id !== contributorId);

  if (nowFullyFunded) {
    // Fully-funded milestone — fire immediately, never batch this one
    sendPushToMany(guestIds, {
      title: "🎁 Gift Fully Funded!",
      body: `${gift.name} has been fully funded! ₹${target.toLocaleString("en-IN")} collected 🎉`,
      data: { type: "gift_funded", eventId: gift.eventId, giftId },
    }).catch(() => {});
    logger.info("Gift fully funded", { giftId, eventId: gift.eventId, name: gift.name });
  } else {
    // Regular contribution — batch within a 2-minute window to avoid notification spam
    scheduleContributionNotification(gift.eventId, guestIds, contributorName, amount, gift.name);
  }

  return res.status(201).json({
    id: contribution.id,
    giftId: contribution.giftId,
    contributorId: contribution.contributorId,
    contributorName: contribution.contributorName,
    amount: parseFloat(contribution.amount),
    createdAt: contribution.createdAt.toISOString(),
  });
});

// GET /api/gifts/:eventId/live — Server-Sent Events for real-time gift progress
router.get("/:eventId/live", (req, res) => {
  const { eventId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Register subscriber
  if (!sseSubscribers.has(eventId)) sseSubscribers.set(eventId, new Set());
  sseSubscribers.get(eventId)!.add(res);

  // Send current state immediately
  db.select().from(eventGiftsTable).where(eq(eventGiftsTable.eventId, eventId))
    .then(gifts => {
      res.write(`data: ${JSON.stringify({ gifts: gifts.map(g => ({
        id: g.id, name: g.name,
        targetAmount: parseFloat(g.targetAmount),
        currentAmount: parseFloat(g.currentAmount ?? "0"),
        isFullyFunded: parseFloat(g.currentAmount ?? "0") >= parseFloat(g.targetAmount),
      })) })}\n\n`);
    })
    .catch(() => {});

  // Heartbeat every 25s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch {}
  }, 25000);

  // Cleanup on disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    sseSubscribers.get(eventId)?.delete(res);
    if (sseSubscribers.get(eventId)?.size === 0) sseSubscribers.delete(eventId);
  });
});

// GET /api/gifts/:eventId
router.get("/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const gifts = await db.select().from(eventGiftsTable).where(eq(eventGiftsTable.eventId, eventId));
  return res.json(gifts.map(g => ({
    id: g.id,
    eventId: g.eventId,
    name: g.name,
    category: g.category,
    targetAmount: parseFloat(g.targetAmount),
    currentAmount: parseFloat(g.currentAmount ?? "0"),
    imageEmoji: g.imageEmoji,
    isFullyFunded: parseFloat(g.currentAmount ?? "0") >= parseFloat(g.targetAmount),
  })));
});

// POST /api/gifts/:eventId — create a gift item
router.post("/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const { name, category, targetAmount, imageEmoji } = req.body;

  const id = generateId();
  const [gift] = await db.insert(eventGiftsTable).values({
    id, eventId, name, category,
    targetAmount: targetAmount.toString(),
    currentAmount: "0",
    imageEmoji,
  }).returning();

  return res.status(201).json({
    id: gift.id,
    eventId: gift.eventId,
    name: gift.name,
    category: gift.category,
    targetAmount: parseFloat(gift.targetAmount),
    currentAmount: 0,
    imageEmoji: gift.imageEmoji,
    isFullyFunded: false,
  });
});

export default router;
