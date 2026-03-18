import { Router } from "express";
import crypto from "crypto";

const router = Router();

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  const Razorpay = require("razorpay");
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// POST /api/payments/create-order
// Creates a Razorpay order before showing the payment sheet
router.post("/create-order", async (req, res) => {
  const { amount, currency = "INR", notes } = req.body;

  if (!amount || typeof amount !== "number" || amount < 1) {
    return res.status(400).json({ error: "Valid amount in rupees is required" });
  }

  const razorpay = getRazorpay();
  if (!razorpay) {
    // If Razorpay keys are not set, return a mock order for dev/demo mode
    return res.json({
      id: "demo_order_" + Date.now(),
      amount: amount * 100,
      currency,
      keyId: "demo",
      isDemoMode: true,
    });
  }

  try {
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Razorpay expects paise
      currency,
      notes: notes ?? {},
    });
    return res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      isDemoMode: false,
    });
  } catch (err: any) {
    console.error("[Razorpay] order creation failed:", err.message);
    return res.status(500).json({ error: "Payment order creation failed. Please try again." });
  }
});

// POST /api/payments/verify
// Verifies the Razorpay payment signature after checkout completes
router.post("/verify", async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    // Demo mode — skip verification
    return res.json({ verified: true, isDemoMode: true });
  }

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: "Missing payment verification fields" });
  }

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expected !== razorpay_signature) {
    return res.status(400).json({ error: "Payment signature mismatch. Transaction rejected." });
  }

  return res.json({ verified: true, paymentId: razorpay_payment_id });
});

export default router;
