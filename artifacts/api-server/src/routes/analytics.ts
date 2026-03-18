/**
 * Analytics Routes
 *
 * POST /api/analytics/event  — track a user action (auth optional)
 * GET  /api/analytics/summary — funnel overview (auth required)
 */

import { Router } from "express";
import { db, analyticsEventsTable } from "@workspace/db";
import { eq, sql, desc, gte } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import logger from "../lib/logger";

const router = Router();

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// Valid events the client is allowed to track
const ALLOWED_EVENTS = new Set([
  "screen_view",
  "ai_suggestion_fetched",
  "ai_message_copied",
  "amount_selected",
  "amount_custom_entered",
  "payment_initiated",
  "payment_success",
  "payment_failed",
  "payment_dismissed",
  "shagun_sent",
  "event_created",
  "event_joined",
  "gift_contributed",
  "ledger_viewed",
  "profile_viewed",
  "reveal_viewed",
]);

// POST /api/analytics/event
// Auth is optional — we accept both logged-in and anonymous events
router.post("/event", async (req, res) => {
  const { event, properties, platform, appVersion, userId: bodyUserId } = req.body;

  if (!event || typeof event !== "string") {
    return res.status(400).json({ error: "event is required" });
  }

  if (!ALLOWED_EVENTS.has(event)) {
    // Silently accept unknown events but don't store them (avoids spam)
    return res.status(200).json({ ok: true });
  }

  // Try to extract userId from JWT if present (don't require it)
  let userId: string | undefined = bodyUserId;
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const jwt = await import("jsonwebtoken");
      const secret = process.env.JWT_SECRET ?? "dev_insecure_fallback";
      const decoded = jwt.default.verify(authHeader.slice(7), secret) as { userId: string };
      if (decoded.userId) userId = decoded.userId;
    } catch {}
  }

  const propsString = properties && typeof properties === "object"
    ? JSON.stringify(properties)
    : typeof properties === "string" ? properties : null;

  try {
    await db.insert(analyticsEventsTable).values({
      id: generateId(),
      userId: userId ?? null,
      event,
      properties: propsString,
      platform: platform ?? null,
      appVersion: appVersion ?? null,
    });
  } catch (err: any) {
    logger.error("Analytics insert failed", { error: err.message, event });
  }

  return res.status(200).json({ ok: true });
});

// GET /api/analytics/summary?days=7
// Returns a funnel overview for the last N days
router.get("/summary", requireAuth, async (req: AuthRequest, res) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days as string) || 7));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // Event counts
    const counts = await db
      .select({
        event: analyticsEventsTable.event,
        count: sql<number>`COUNT(*)`,
      })
      .from(analyticsEventsTable)
      .where(gte(analyticsEventsTable.createdAt, since))
      .groupBy(analyticsEventsTable.event)
      .orderBy(desc(sql`COUNT(*)`));

    // Unique users
    const uniqueUsers = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${analyticsEventsTable.userId})` })
      .from(analyticsEventsTable)
      .where(gte(analyticsEventsTable.createdAt, since));

    // Daily active users for the period
    const dailyActiveUsers = await db
      .select({
        date: sql<string>`DATE(${analyticsEventsTable.createdAt})`,
        users: sql<number>`COUNT(DISTINCT ${analyticsEventsTable.userId})`,
      })
      .from(analyticsEventsTable)
      .where(gte(analyticsEventsTable.createdAt, since))
      .groupBy(sql`DATE(${analyticsEventsTable.createdAt})`)
      .orderBy(sql`DATE(${analyticsEventsTable.createdAt})`);

    // Conversion: payment_initiated → payment_success
    const initiated = counts.find(c => c.event === "payment_initiated")?.count ?? 0;
    const success = counts.find(c => c.event === "payment_success")?.count ?? 0;
    const conversionRate = initiated > 0 ? Math.round((Number(success) / Number(initiated)) * 100) : null;

    return res.json({
      periodDays: days,
      since: since.toISOString(),
      uniqueUsers: Number(uniqueUsers[0]?.count ?? 0),
      eventCounts: counts.map(c => ({ event: c.event, count: Number(c.count) })),
      dailyActiveUsers: dailyActiveUsers.map(d => ({ date: d.date, users: Number(d.users) })),
      paymentConversionRate: conversionRate !== null ? `${conversionRate}%` : null,
    });
  } catch (err: any) {
    logger.error("Analytics summary failed", { error: err.message });
    return res.status(500).json({ error: "Could not load analytics summary" });
  }
});

export default router;
