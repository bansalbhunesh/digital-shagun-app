import { Router } from "express";
import crypto from "crypto";
import { db, paymentsTable, transactionsTable, eventsTable, relationshipLedgerTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const REVEAL_DELAY_MINUTES = 10;

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  const Razorpay = require("razorpay");
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// POST /api/payments/create-order
// Creates a Razorpay order and saves it as pending in DB
router.post("/create-order", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { amount, receiverId, eventId = "direct", receiverName = "" } = req.body;

  if (!amount || typeof amount !== "number" || amount < 1) {
    return res.status(400).json({ error: "Valid amount in rupees is required" });
  }
  if (!receiverId || typeof receiverId !== "string") {
    return res.status(400).json({ error: "receiverId is required" });
  }

  const razorpay = getRazorpay();
  if (!razorpay) {
    const demoOrderId = "demo_order_" + generateId();
    await db.insert(paymentsTable).values({
      id: generateId(),
      orderId: demoOrderId,
      userId,
      receiverId,
      eventId,
      amount: amount.toString(),
      status: "pending",
    });
    return res.json({ id: demoOrderId, amount: amount * 100, currency: "INR", keyId: "demo", isDemoMode: true });
  }

  try {
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      notes: { receiverId, eventId, receiverName, userId },
    });

    await db.insert(paymentsTable).values({
      id: generateId(),
      orderId: order.id,
      userId,
      receiverId,
      eventId,
      amount: amount.toString(),
      status: "pending",
    });

    return res.json({ id: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID, isDemoMode: false });
  } catch (err: any) {
    console.error("[Razorpay] order creation failed:", err.message);
    return res.status(500).json({ error: "Payment order creation failed. Please try again." });
  }
});

// POST /api/payments/capture
// Atomic: verify signature + verify amount with Razorpay + record shagun + update ledger — all in one DB transaction
router.post("/capture", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, senderName, receiverName, message } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id) {
    return res.status(400).json({ error: "razorpay_order_id and razorpay_payment_id are required" });
  }

  // Look up the order in our DB
  const [paymentRecord] = await db.select().from(paymentsTable)
    .where(eq(paymentsTable.orderId, razorpay_order_id)).limit(1);

  if (!paymentRecord) {
    return res.status(404).json({ error: "Payment order not found" });
  }

  // Idempotency: already captured?
  if (paymentRecord.status === "captured" && paymentRecord.transactionId) {
    const [existingTx] = await db.select().from(transactionsTable)
      .where(eq(transactionsTable.id, paymentRecord.transactionId)).limit(1);
    if (existingTx) {
      return res.json({
        transactionId: existingTx.id,
        amount: parseFloat(existingTx.amount),
        alreadyCaptured: true,
      });
    }
  }

  const isDemoMode = razorpay_order_id.startsWith("demo_order_");

  // Verify HMAC signature (skip for demo mode)
  if (!isDemoMode) {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(500).json({ error: "Payment configuration error" });
    }
    if (!razorpay_signature) {
      return res.status(400).json({ error: "razorpay_signature is required for real payments" });
    }
    const expected = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (expected !== razorpay_signature) {
      await db.update(paymentsTable).set({ status: "failed" }).where(eq(paymentsTable.orderId, razorpay_order_id));
      return res.status(400).json({ error: "Payment signature mismatch. Transaction rejected." });
    }

    // Verify payment amount with Razorpay (prevents frontend amount tampering)
    try {
      const razorpay = getRazorpay();
      if (razorpay) {
        const rpPayment = await razorpay.payments.fetch(razorpay_payment_id);
        const paidPaise = parseInt(rpPayment.amount, 10);
        const expectedPaise = Math.round(parseFloat(paymentRecord.amount) * 100);
        if (paidPaise !== expectedPaise) {
          console.error(`[capture] Amount mismatch: expected ${expectedPaise} paise, Razorpay reports ${paidPaise} paise`);
          await db.update(paymentsTable).set({ status: "failed" }).where(eq(paymentsTable.orderId, razorpay_order_id));
          return res.status(400).json({ error: "Payment amount mismatch. Transaction rejected for security." });
        }
        if (rpPayment.order_id !== razorpay_order_id) {
          await db.update(paymentsTable).set({ status: "failed" }).where(eq(paymentsTable.orderId, razorpay_order_id));
          return res.status(400).json({ error: "Payment order ID mismatch. Transaction rejected." });
        }
        if (rpPayment.status !== "captured" && rpPayment.status !== "authorized") {
          await db.update(paymentsTable).set({ status: "failed" }).where(eq(paymentsTable.orderId, razorpay_order_id));
          return res.status(400).json({ error: `Payment not completed (status: ${rpPayment.status}).` });
        }
      }
    } catch (verifyErr: any) {
      console.error("[capture] Razorpay amount verification failed:", verifyErr.message);
      return res.status(500).json({ error: "Could not verify payment with Razorpay. Please contact support." });
    }
  }

  const amount = parseFloat(paymentRecord.amount);
  const { receiverId, eventId } = paymentRecord;
  const resolvedSenderName = senderName ?? userId;
  const resolvedReceiverName = receiverName ?? receiverId;

  // Atomic: update payment + create shagun transaction + update ledger
  let transactionId: string;
  try {
    await db.transaction(async (tx) => {
      const txId = generateId();
      transactionId = txId;
      const revealAt = new Date(Date.now() + REVEAL_DELAY_MINUTES * 60 * 1000);

      // Insert shagun transaction
      await tx.insert(transactionsTable).values({
        id: txId,
        eventId,
        senderId: userId,
        senderName: resolvedSenderName,
        receiverId,
        amount: amount.toString(),
        message: message ?? null,
        isRevealed: "false",
        revealAt,
      });

      // Mark payment captured
      await tx.update(paymentsTable)
        .set({ status: "captured", paymentId: razorpay_payment_id, signature: razorpay_signature ?? null, capturedAt: new Date(), transactionId: txId })
        .where(eq(paymentsTable.orderId, razorpay_order_id));

      // Update ledger — sender side
      await upsertLedger(tx, userId, resolvedSenderName, receiverId, "sent", amount, eventId, resolvedReceiverName);
      // Update ledger — receiver side
      await upsertLedger(tx, receiverId, "", userId, "received", amount, eventId, resolvedSenderName);

      // Attach event name to ledger if non-direct
      if (eventId !== "direct") {
        const [event] = await tx.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
        if (event) {
          await tx.update(relationshipLedgerTable)
            .set({ lastEventName: event.title, lastEventDate: event.date })
            .where(and(eq(relationshipLedgerTable.userId, userId), eq(relationshipLedgerTable.contactId, receiverId)));
        }
      } else {
        await tx.update(relationshipLedgerTable)
          .set({ lastEventName: "Direct Shagun" })
          .where(and(eq(relationshipLedgerTable.userId, userId), eq(relationshipLedgerTable.contactId, receiverId)));
      }
    });
  } catch (err: any) {
    console.error("[capture] DB transaction failed:", err.message);
    return res.status(500).json({ error: "Failed to record payment. Please contact support with your payment ID." });
  }

  return res.status(201).json({ transactionId: transactionId!, amount, eventId, receiverId });
});

// POST /api/payments/webhook
// Razorpay webhook — raw body needed for signature verification
router.post("/webhook", async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers["x-razorpay-signature"];

  if (webhookSecret) {
    if (!signature || typeof signature !== "string") {
      return res.status(400).json({ error: "Missing webhook signature" });
    }
    const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body));
    const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
    if (expected !== signature) {
      console.warn("[webhook] Signature mismatch — rejected");
      return res.status(400).json({ error: "Webhook signature invalid" });
    }
  }

  const payload = req.body instanceof Buffer ? JSON.parse(req.body.toString()) : req.body;
  const event = payload?.event;
  const paymentEntity = payload?.payload?.payment?.entity;

  if (!event || !paymentEntity) {
    return res.status(200).json({ received: true });
  }

  const orderId = paymentEntity.order_id;
  const paymentId = paymentEntity.id;

  if (!orderId) return res.status(200).json({ received: true });

  try {
    if (event === "payment.captured") {
      await db.update(paymentsTable)
        .set({ webhookVerified: true, paymentId, status: "captured", capturedAt: new Date() })
        .where(and(eq(paymentsTable.orderId, orderId), eq(paymentsTable.status, "pending")));
      console.log(`[webhook] payment.captured: order=${orderId}, payment=${paymentId}`);
    } else if (event === "payment.failed") {
      await db.update(paymentsTable)
        .set({ status: "failed" })
        .where(and(eq(paymentsTable.orderId, orderId), eq(paymentsTable.status, "pending")));
      console.log(`[webhook] payment.failed: order=${orderId}`);
    }
  } catch (err: any) {
    console.error("[webhook] DB update failed:", err.message);
  }

  return res.status(200).json({ received: true });
});

// Upsert a ledger row inside a transaction
async function upsertLedger(
  tx: any,
  userId: string,
  userName: string,
  contactId: string,
  direction: "sent" | "received",
  amount: number,
  _eventId: string,
  contactName?: string,
) {
  const existing = await tx.select().from(relationshipLedgerTable)
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
    await tx.update(relationshipLedgerTable).set(updates).where(eq(relationshipLedgerTable.id, curr.id));
  } else {
    await tx.insert(relationshipLedgerTable).values({
      id: generateId(),
      userId,
      contactId,
      contactName: contactName ?? "",
      totalGiven: direction === "sent" ? amount.toString() : "0",
      totalReceived: direction === "received" ? amount.toString() : "0",
    });
  }
}

export default router;
