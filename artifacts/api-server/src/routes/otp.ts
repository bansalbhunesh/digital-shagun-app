import { Router } from "express";
import { db, otpTable, usersTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { signToken } from "../middleware/auth";

const router = Router();

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/otp/send  → generate OTP for a phone number
router.post("/send", async (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ error: "Invalid Indian phone number" });
  }

  const code = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  // Invalidate old OTPs for this phone
  await db.update(otpTable).set({ used: true })
    .where(and(eq(otpTable.phone, phone), eq(otpTable.used, false)));

  await db.insert(otpTable).values({ id: generateId(), phone, code, expiresAt });

  // --- SMS delivery ---
  // To send real OTPs, set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
  // in your environment secrets and uncomment the Twilio block below.
  // Without those, the code is returned in the response for testing only.
  //
  // const twilio = require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // await twilio.messages.create({
  //   body: `Your Shagun OTP is ${code}. Valid for 10 minutes.`,
  //   from: process.env.TWILIO_FROM_NUMBER,
  //   to: `+91${phone}`,
  // });

  const isProd = process.env.NODE_ENV === "production";
  return res.json({
    success: true,
    // In production with real SMS, never return the code. Remove this field after adding Twilio.
    ...(isProd ? {} : { devCode: code }),
    message: isProd
      ? "OTP sent to your mobile number"
      : "OTP generated (dev mode — check devCode field or Twilio for prod)",
  });
});

// POST /api/otp/verify  → verify OTP + login/register user
router.post("/verify", async (req, res) => {
  const { phone, code, name } = req.body;
  if (!phone || !code || !name) {
    return res.status(400).json({ error: "phone, code, and name are required" });
  }

  const now = new Date();
  const [otp] = await db.select().from(otpTable)
    .where(and(
      eq(otpTable.phone, phone),
      eq(otpTable.code, code),
      eq(otpTable.used, false),
      gt(otpTable.expiresAt, now),
    )).limit(1);

  if (!otp) {
    return res.status(401).json({ error: "Invalid or expired OTP. Please try again." });
  }

  // Mark OTP as used
  await db.update(otpTable).set({ used: true }).where(eq(otpTable.id, otp.id));

  // Find or create user
  const AVATAR_COLORS = [
    "#8B0000", "#B8860B", "#6B2737", "#8B4513", "#556B2F",
    "#483D8B", "#2F4F4F", "#8B1A1A", "#704214", "#5C4033",
  ];

  const existing = await db.select().from(usersTable).where(eq(usersTable.phone, phone)).limit(1);
  if (existing.length > 0) {
    const u = existing[0];
    const token = signToken(u.id, u.phone);
    return res.json({ id: u.id, name: u.name, phone: u.phone, avatarColor: u.avatarColor, createdAt: u.createdAt.toISOString(), token });
  }

  const id = generateId();
  const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const [user] = await db.insert(usersTable).values({ id, name, phone, avatarColor }).returning();
  const token = signToken(user.id, user.phone);

  return res.json({ id: user.id, name: user.name, phone: user.phone, avatarColor: user.avatarColor, createdAt: user.createdAt.toISOString(), token });
});

export default router;
