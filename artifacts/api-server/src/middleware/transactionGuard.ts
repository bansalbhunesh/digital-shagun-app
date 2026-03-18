/**
 * Transaction-level abuse protection middleware.
 *
 * Three layers of defence:
 * 1. Per-user rate limit   — max 10 shagun transactions per rolling hour
 * 2. Duplicate guard       — same sender + receiver + amount within 60 s → reject
 * 3. Minimum amount check  — enforced here so it can never be bypassed
 *
 * All state is in-memory (LRU-style maps with TTL eviction).
 * At multi-instance scale replace with a Redis sliding window.
 */

import { type Request, type Response, type NextFunction } from "express";
import { type AuthRequest } from "./auth";
import logger from "../lib/logger";

const MAX_TX_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;
const DUPLICATE_WINDOW_MS = 60 * 1000; // 60 seconds
const MIN_AMOUNT = 1;

// Stores timestamps of recent transactions keyed by userId
const userTxLog = new Map<string, number[]>();

// Stores fingerprint → timestamp for duplicate detection
const recentFingerprints = new Map<string, number>();

// Evict stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();

  for (const [userId, timestamps] of userTxLog) {
    const fresh = timestamps.filter(t => now - t < HOUR_MS);
    if (fresh.length === 0) userTxLog.delete(userId);
    else userTxLog.set(userId, fresh);
  }

  for (const [fp, ts] of recentFingerprints) {
    if (now - ts > DUPLICATE_WINDOW_MS) recentFingerprints.delete(fp);
  }
}, 10 * 60 * 1000);

export function transactionGuard(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;

  if (!userId) return next(); // requireAuth runs before us and will reject

  const { receiverId, amount } = req.body;
  const now = Date.now();

  // ── 1. Minimum amount ──────────────────────────────────────────────────
  const parsedAmount = typeof amount === "number" ? amount : parseFloat(amount);
  if (!parsedAmount || parsedAmount < MIN_AMOUNT) {
    return res.status(400).json({ error: `Minimum shagun amount is ₹${MIN_AMOUNT}` });
  }

  // ── 2. Per-user hourly rate limit ──────────────────────────────────────
  const timestamps = (userTxLog.get(userId) ?? []).filter(t => now - t < HOUR_MS);
  if (timestamps.length >= MAX_TX_PER_HOUR) {
    const oldestInWindow = Math.min(...timestamps);
    const resetsInMs = HOUR_MS - (now - oldestInWindow);
    const resetsInMin = Math.ceil(resetsInMs / 60000);
    logger.warn("Transaction rate limit hit", { userId, count: timestamps.length });
    return res.status(429).json({
      error: `You've sent ${MAX_TX_PER_HOUR} shagun in the last hour. Please wait ${resetsInMin} minute${resetsInMin !== 1 ? "s" : ""} before sending more.`,
    });
  }

  // ── 3. Duplicate detection ─────────────────────────────────────────────
  if (receiverId) {
    // Round amount to nearest integer for fingerprint (avoids float noise)
    const fingerprint = `${userId}:${receiverId}:${Math.round(parsedAmount)}`;
    const lastSeen = recentFingerprints.get(fingerprint);
    if (lastSeen && now - lastSeen < DUPLICATE_WINDOW_MS) {
      const secondsAgo = Math.round((now - lastSeen) / 1000);
      logger.warn("Duplicate transaction blocked", { userId, receiverId, amount: parsedAmount, secondsAgo });
      return res.status(409).json({
        error: `You already sent ₹${Math.round(parsedAmount).toLocaleString("en-IN")} to this person ${secondsAgo} second${secondsAgo !== 1 ? "s" : ""} ago. Wait a moment before sending again.`,
      });
    }
    recentFingerprints.set(fingerprint, now);
  }

  // Record this transaction attempt for rate limiting
  timestamps.push(now);
  userTxLog.set(userId, timestamps);

  next();
}
