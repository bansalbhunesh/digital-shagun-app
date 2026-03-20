import { Router } from "express";
import {
  db,
  eventGiftsTable,
  giftContributionsTable,
  usersTable,
  eventsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

import { generateId } from "../utils/id";
router.post("/contribute", requireAuth, async (req, res) => {
  const { giftId, amount } = req.body;
  const contributorId = req.user!.id;

  const [contributor] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, contributorId))
    .limit(1);
  const contributorName = contributor?.name ?? "Anonymous";

  const [gift] = await db
    .select()
    .from(eventGiftsTable)
    .where(eq(eventGiftsTable.id, giftId))
    .limit(1);
  if (!gift) return res.status(404).json({ error: "Gift not found" });

  const contribution = await db.transaction(async (tx) => {
    // Re-fetch gift in transaction to avoid race
    const [g] = await tx
      .select()
      .from(eventGiftsTable)
      .where(eq(eventGiftsTable.id, giftId))
      .limit(1);

    const newAmount = Math.min(
      parseFloat(g.currentAmount ?? "0") + amount,
      parseFloat(g.targetAmount)
    );

    await tx
      .update(eventGiftsTable)
      .set({ currentAmount: newAmount.toString() })
      .where(eq(eventGiftsTable.id, giftId));

    const id = generateId();
    const [c] = await tx
      .insert(giftContributionsTable)
      .values({
        id,
        giftId,
        eventId: g.eventId,
        contributorId,
        contributorName,
        amount: amount.toString(),
      })
      .returning();

    return c;
  });

  return res.status(201).json({
    id: contribution.id,
    giftId: contribution.giftId,
    contributorId: contribution.contributorId,
    contributorName: contribution.contributorName,
    amount: parseFloat(contribution.amount),
    createdAt: contribution.createdAt.toISOString(),
  });
});

router.get("/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const gifts = await db.select().from(eventGiftsTable).where(eq(eventGiftsTable.eventId, eventId));
  return res.json(
    gifts.map((g) => ({
      id: g.id,
      eventId: g.eventId,
      name: g.name,
      category: g.category,
      targetAmount: parseFloat(g.targetAmount),
      currentAmount: parseFloat(g.currentAmount ?? "0"),
      imageEmoji: g.imageEmoji,
      isFullyFunded: parseFloat(g.currentAmount ?? "0") >= parseFloat(g.targetAmount),
    }))
  );
});

router.post("/:eventId", requireAuth, async (req, res) => {
  const { eventId } = req.params;
  const { name, category, targetAmount, imageEmoji } = req.body;
  const userId = req.user!.id;

  const [event] = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.id, eventId as string))
    .limit(1);
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.hostId !== userId)
    return res.status(403).json({ error: "Forbidden: Only the event host can add gifts." });

  const id = generateId();
  const [gift] = await db
    .insert(eventGiftsTable)
    .values({
      id,
      eventId: eventId as string,
      name,
      category,
      targetAmount: targetAmount.toString(),
      currentAmount: "0",
      imageEmoji,
    })
    .returning();

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
