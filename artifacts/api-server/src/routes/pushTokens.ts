/**
 * Push Token Routes
 *
 * POST /api/push/register   — register an Expo push token for the current user
 * DELETE /api/push/register — remove a token (on logout)
 */

import { Router } from "express";
import { db, pushTokensTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import logger from "../lib/logger";

const router = Router();

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// POST /api/push/register
router.post("/register", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { token, platform } = req.body;

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "token is required" });
  }

  // Validate it looks like an Expo push token
  if (!/^ExponentPushToken\[.+\]$/.test(token) && !/^[a-zA-Z0-9_-]{22,}$/.test(token)) {
    return res.status(400).json({ error: "Invalid push token format" });
  }

  try {
    // Upsert — if the token already exists for this user, update timestamp
    const existing = await db.select().from(pushTokensTable)
      .where(and(eq(pushTokensTable.userId, userId), eq(pushTokensTable.token, token)))
      .limit(1);

    if (existing.length > 0) {
      await db.update(pushTokensTable)
        .set({ updatedAt: new Date(), platform: platform ?? null })
        .where(eq(pushTokensTable.id, existing[0].id));
    } else {
      await db.insert(pushTokensTable).values({
        id: generateId(),
        userId,
        token,
        platform: platform ?? null,
      });
      logger.info("Push token registered", { userId, platform });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    logger.error("Push token register failed", { error: err.message, userId });
    return res.status(500).json({ error: "Could not register push token" });
  }
});

// DELETE /api/push/register
router.delete("/register", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { token } = req.body;

  if (!token) return res.status(400).json({ error: "token is required" });

  await db.delete(pushTokensTable)
    .where(and(eq(pushTokensTable.userId, userId), eq(pushTokensTable.token, token)))
    .catch(() => {});

  logger.info("Push token removed", { userId });
  return res.json({ ok: true });
});

export default router;
