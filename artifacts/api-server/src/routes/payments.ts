import { Router } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { db, paymentsTable, transactionsTable, eventGiftsTable, giftContributionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { generateId } from "../utils/id";
import { updateLedgerInTransaction } from "./shagun";

const router = Router();

// Razorpay instance (keys should be in env)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

if (process.env.NODE_ENV === "production" && (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)) {
  console.error("CRITICAL: Razorpay keys are missing in production!");
}

router.post("/create-order", requireAuth, async (req, res) => {
  const { amount, giftId, eventId, receiverId, message, idempotencyKey } = req.body;
  const userId = req.user!.id;

  if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });

  try {
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // in paise
      currency: "INR",
      receipt: `receipt_${generateId()}`,
    });

    await db.insert(paymentsTable).values({
      id: generateId(),
      orderId: order.id,
      userId,
      amount: amount.toString(),
      status: "created",
      giftId: giftId ?? null,
      eventId: eventId ?? null,
      receiverId: receiverId ?? null,
      message: message ?? null,
      idempotencyKey: idempotencyKey ?? null,
    });

    return res.json({
      orderId: order.id,
      amount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error("Razorpay order creation failed:", error);
    return res.status(500).json({ error: "Failed to create payment order" });
  }
});

router.post("/webhook", async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "mock_webhook_secret";
  const signature = req.headers["x-razorpay-signature"] as string;

  const body = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  if (signature !== expectedSignature) {
    return res.status(400).json({ error: "Invalid signature" });
  }

  const { event, payload } = req.body;
  
  if (event === "payment.captured") {
    const payment = payload.payment.entity;
    const orderId = payment.order_id;
    const paymentId = payment.id;

    const [p] = await db.select().from(paymentsTable).where(eq(paymentsTable.orderId, orderId)).limit(1);
    
    if (!p) return res.status(404).json({ error: "Order not found" });
    if (p.status === "captured") return res.json({ status: "already_processed" });

    // Atomic update of payment status and ledger/gift
    await db.transaction(async (tx) => {
      await tx.update(paymentsTable)
        .set({ status: "captured", paymentId, rawPayload: body, updatedAt: new Date() })
        .where(eq(paymentsTable.id, p.id));

      if (p.giftId) {
        // Handle gift contribution
        const [gift] = await tx.select().from(eventGiftsTable).where(eq(eventGiftsTable.id, p.giftId)).limit(1);
        if (gift) {
          const newAmount = Math.min(
            parseFloat(gift.currentAmount ?? "0") + parseFloat(p.amount),
            parseFloat(gift.targetAmount)
          );
          await tx.update(eventGiftsTable).set({ currentAmount: newAmount.toString() }).where(eq(eventGiftsTable.id, gift.id));
          
          const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, p.userId)).limit(1);
          await tx.insert(giftContributionsTable).values({
            id: generateId(),
            giftId: gift.id,
            eventId: gift.eventId,
            contributorId: p.userId,
            contributorName: user?.name ?? "Anonymous",
            amount: p.amount,
          });
        }
      } else if (p.receiverId) {
        // Handle shagun transaction
        const [sender] = await tx.select().from(usersTable).where(eq(usersTable.id, p.userId)).limit(1);
        const senderName = sender?.name ?? "Anonymous";
        
        const [receiver] = await tx.select().from(usersTable).where(eq(usersTable.id, p.receiverId)).limit(1);
        const receiverName = receiver?.name ?? "Anonymous";

        await tx.insert(transactionsTable).values({
           id: generateId(),
           eventId: p.eventId ?? "direct",
           senderId: p.userId,
           senderName,
           receiverId: p.receiverId,
           amount: p.amount,
           message: p.message,
           isRevealed: "false",
           revealAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min delay
        });
        
        const amountNum = parseFloat(p.amount);
        await updateLedgerInTransaction(tx, p.userId, senderName, p.receiverId, "sent", amountNum, receiverName);
        await updateLedgerInTransaction(tx, p.receiverId, receiverName, p.userId, "received", amountNum, senderName);
      }
    });

    return res.json({ status: "ok" });
  }

  return res.json({ status: "received" });
});

export default router;
