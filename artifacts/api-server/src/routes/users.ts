import { Router } from "express";
import { db, usersTable, relationshipLedgerTable, transactionsTable, eventsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { validateRequest } from "../middlewares/validate";
import { CreateUserBody } from "@workspace/api-zod";

const router = Router();

const AVATAR_COLORS = [
  "#8B0000", "#B8860B", "#6B2737", "#8B4513", "#556B2F",
  "#483D8B", "#2F4F4F", "#8B1A1A", "#704214", "#5C4033",
];

router.post("/", requireAuth, validateRequest(CreateUserBody), async (req, res) => {
  const { name, phone } = req.body;
  const id = req.user!.id;

  const existing = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (existing.length > 0) {
    const u = existing[0];
    if (u.name !== name || u.phone !== phone) {
      await db.update(usersTable).set({ name, phone }).where(eq(usersTable.id, id));
    }
    return res.json({
      id: u.id,
      name,
      phone,
      avatarColor: u.avatarColor,
      createdAt: u.createdAt.toISOString(),
    });
  }

  const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  const [user] = await db.insert(usersTable).values({ id, name, phone, avatarColor }).returning();

  return res.json({
    id: user.id,
    name: user.name,
    phone: user.phone,
    avatarColor: user.avatarColor,
    createdAt: user.createdAt.toISOString(),
  });
});

router.get("/:userId/stats", async (req, res) => {
  const { userId } = req.params;

  const ledgerRows = await db.select().from(relationshipLedgerTable)
    .where(eq(relationshipLedgerTable.userId, userId));

  const totalGiven = ledgerRows.reduce((s, r) => s + parseFloat(r.totalGiven ?? "0"), 0);
  const totalReceived = ledgerRows.reduce((s, r) => s + parseFloat(r.totalReceived ?? "0"), 0);
  const relationshipCount = ledgerRows.length;

  const sentTransactions = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.senderId, userId));

  const receivedTransactions = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.receiverId, userId));

  const hostedEvents = await db.select().from(eventsTable)
    .where(eq(eventsTable.hostId, userId));

  const topGiver = ledgerRows
    .filter(r => r.contactName)
    .sort((a, b) => parseFloat(b.totalGiven ?? "0") - parseFloat(a.totalGiven ?? "0"))[0];

  const topReceiver = ledgerRows
    .filter(r => r.contactName)
    .sort((a, b) => parseFloat(b.totalReceived ?? "0") - parseFloat(a.totalReceived ?? "0"))[0];

  return res.json({
    userId,
    totalGiven,
    totalReceived,
    balance: totalReceived - totalGiven,
    relationshipCount,
    shagunSentCount: sentTransactions.length,
    shagunReceivedCount: receivedTransactions.length,
    eventsHosted: hostedEvents.length,
    topGiver: topGiver ? {
      name: topGiver.contactName,
      amount: parseFloat(topGiver.totalGiven ?? "0"),
    } : null,
    topReceiver: topReceiver ? {
      name: topReceiver.contactName,
      amount: parseFloat(topReceiver.totalReceived ?? "0"),
    } : null,
  });
});

router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({
    id: user.id,
    name: user.name,
    phone: user.phone,
    avatarColor: user.avatarColor,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
