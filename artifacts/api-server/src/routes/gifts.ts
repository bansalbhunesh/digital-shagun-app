import { Router } from "express";
import { db, eventGiftsTable, giftContributionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

import { generateId } from "../utils/id";
router.post("/contribute", requireAuth, async (req, res) => {
  const { giftId, amount } = req.body;
  const contributorId = req.user!.id;
  
  const [contributor] = await db.select().from(usersTable).where(eq(usersTable.id, contributorId)).limit(1);
  const contributorName = contributor?.name ?? "Anonymous";

  const [gift] = await db.select().from(eventGiftsTable).where(eq(eventGiftsTable.id, giftId)).limit(1);
  if (!gift) return res.status(404).json({ error: "Gift not found" });

  const newAmount = Math.min(
    parseFloat(gift.currentAmount ?? "0") + amount,
    parseFloat(gift.targetAmount)
  );

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
