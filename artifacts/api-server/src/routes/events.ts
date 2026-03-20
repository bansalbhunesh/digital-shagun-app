import { Router } from "express";
import { db, eventsTable, eventGuestsTable, transactionsTable, eventGiftsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

import { generateId } from "../utils/id";
function generateShareCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function formatEvent(e: any) {
  return {
    id: e.id,
    title: e.title,
    type: e.type,
    hostId: e.hostId,
    hostName: e.hostName,
    date: e.date,
    venue: e.venue ?? null,
    description: e.description ?? null,
    shareCode: e.shareCode,
    totalReceived: parseFloat(e.totalReceived ?? "0"),
    guestCount: e.guestCount ?? 0,
    createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
  };
}

router.get("/", async (req, res) => {
  const { hostId } = req.query;
  let events;
  if (hostId) {
    events = await db.select().from(eventsTable).where(eq(eventsTable.hostId, hostId as string));
  } else {
    events = await db.select().from(eventsTable);
  }

  const result = await Promise.all(events.map(async (e) => {
    const txResult = await db.select({ total: sql<string>`COALESCE(SUM(CAST(${transactionsTable.amount} AS NUMERIC)), 0)` })
      .from(transactionsTable).where(eq(transactionsTable.eventId, e.id));
    const totalReceived = parseFloat(txResult[0]?.total ?? "0");
    return formatEvent({ ...e, totalReceived, hostId: e.hostId });
  }));

  return res.json(result);
});

router.post("/", requireAuth, async (req, res) => {
  const { title, type, hostId, hostName, date, venue, description } = req.body;
  const id = generateId();
  let shareCode = generateShareCode();

  const existing = await db.select().from(eventsTable).where(eq(eventsTable.shareCode, shareCode)).limit(1);
  if (existing.length > 0) shareCode = generateShareCode() + Math.random().toString(36).substr(2, 2).toUpperCase();

  const [event] = await db.insert(eventsTable).values({
    id, title, type, hostId, hostName, date,
    venue: venue ?? null,
    description: description ?? null,
    shareCode,
    guestCount: 0,
  }).returning();

  return res.status(201).json(formatEvent({ ...event, totalReceived: 0 }));
});

router.get("/:eventId", async (req, res) => {
  const { eventId } = req.params;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!event) {
    const [byCode] = await db.select().from(eventsTable).where(eq(eventsTable.shareCode, eventId)).limit(1);
    if (!byCode) return res.status(404).json({ error: "Event not found" });
    return processEventDetail(byCode, res);
  }
  return processEventDetail(event, res);
});

async function processEventDetail(event: any, res: any) {
  const txResult = await db.select({ total: sql<string>`COALESCE(SUM(CAST(${transactionsTable.amount} AS NUMERIC)), 0)` })
    .from(transactionsTable).where(eq(transactionsTable.eventId, event.id));
  const totalReceived = parseFloat(txResult[0]?.total ?? "0");

  const shagunList = await db.select().from(transactionsTable).where(eq(transactionsTable.eventId, event.id));
  const gifts = await db.select().from(eventGiftsTable).where(eq(eventGiftsTable.eventId, event.id));

  return res.json({
    event: formatEvent({ ...event, totalReceived }),
    shagunList: shagunList.map(t => ({
      id: t.id,
      eventId: t.eventId,
      senderId: t.senderId,
      senderName: t.senderName,
      receiverId: t.receiverId,
      amount: parseFloat(t.amount),
      message: t.message ?? null,
      isRevealed: t.isRevealed === "true",
      revealAt: t.revealAt instanceof Date ? t.revealAt.toISOString() : t.revealAt,
      createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
    })),
    gifts: gifts.map(g => ({
      id: g.id,
      eventId: g.eventId,
      name: g.name,
      category: g.category,
      targetAmount: parseFloat(g.targetAmount),
      currentAmount: parseFloat(g.currentAmount ?? "0"),
      imageEmoji: g.imageEmoji,
      isFullyFunded: parseFloat(g.currentAmount ?? "0") >= parseFloat(g.targetAmount),
    })),
  });
}

router.post("/:eventId/join", requireAuth, async (req, res) => {
  const { eventId } = req.params;
  const userId = req.user!.id;

  const eventIdStr = eventId as string;
  const userIdStr = userId as string;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventIdStr)).limit(1);
  if (!event) return res.status(404).json({ error: "Event not found" });

  await db.transaction(async (tx) => {
    const existingGuest = await tx.select().from(eventGuestsTable)
      .where(and(eq(eventGuestsTable.eventId, eventIdStr), eq(eventGuestsTable.userId, userIdStr)))
      .limit(1);

    if (existingGuest.length === 0) {
      await tx.insert(eventGuestsTable).values({ id: generateId(), eventId: eventIdStr, userId: userIdStr });
      await tx.update(eventsTable).set({ guestCount: sql`${eventsTable.guestCount} + 1` }).where(eq(eventsTable.id, eventIdStr));
    }
  });

  const [updated] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventIdStr)).limit(1);
  const txResult = await db.select({ total: sql<string>`COALESCE(SUM(CAST(${transactionsTable.amount} AS NUMERIC)), 0)` })
    .from(transactionsTable).where(eq(transactionsTable.eventId, eventIdStr));
  const totalReceived = parseFloat(txResult[0]?.total ?? "0");

  return res.json(formatEvent({ ...updated, totalReceived }));
});

export default router;
