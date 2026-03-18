import { Router } from "express";
import { db, relationshipLedgerTable, transactionsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import logger from "../lib/logger";

const router = Router();

// ─── Versioning ───────────────────────────────────────────────────────────────
// Bump this whenever rule logic changes. Logged in every suggestion so we can
// A/B test and audit historical decisions without guessing which logic ran.
const AI_VERSION = "v2";

// ─── Constants ───────────────────────────────────────────────────────────────

const SHAGUN_AMOUNTS = [101, 151, 201, 251, 301, 401, 501, 701, 1001, 1100, 1501, 2100, 3001, 5001, 7001, 11000, 21000, 51000];

const EVENT_BASE: Record<string, number> = {
  wedding: 501,
  baby_ceremony: 251,
  housewarming: 251,
  birthday: 101,
  festival: 101,
};

const EVENT_LABELS: Record<string, string> = {
  wedding: "wedding (Vivah)",
  baby_ceremony: "baby naming ceremony (Namkaran / Annaprashan)",
  housewarming: "housewarming (Griha Pravesh)",
  birthday: "birthday (Janamdin)",
  festival: "festival celebration",
};

const FALLBACK_MESSAGES: Record<string, string[]> = {
  wedding: [
    "Shubh Vivah! May your life together be full of joy and prosperity 🙏",
    "Bahut Mubarak Ho! Wishing you a lifetime of happiness together",
    "May this sacred bond bring you both blessings and togetherness forever",
    "Vivah ki shubhkamnayein! May your home always be filled with laughter",
  ],
  baby_ceremony: [
    "Bahut Bahut Badhai! May the little one bring endless joy to your family 🌟",
    "Navjaat ki shubhkamnayein! May the baby grow up healthy, happy, and wise",
    "Dil se badhai! This little miracle will make your world beautiful",
    "May the new arrival bring love, laughter, and blessings to your home 🙏",
  ],
  housewarming: [
    "Griha Pravesh Mubarak! May your new home be filled with love and happiness 🏠",
    "May this home bring you warmth, peace, and prosperity always",
    "Naye ghar ki bahut-bahut shubhkamnayein! May every corner be blessed",
    "May your new home witness years of joy and togetherness 🪔",
  ],
  birthday: [
    "Janamdin ki shubhkamnayein! May this year bring you joy, health, and success 🎂",
    "Happy Birthday! May all your dreams come true this year",
    "Bahut Mubarak Ho! Wishing you a day as wonderful as you are",
    "Aapko janamdin ki dher saari shubhkamnayein! Many happy returns!",
  ],
  festival: [
    "Festival ki bahut-bahut shubhkamnayein! May this season bring joy to all 🪔",
    "May this festive season fill your home with love, light, and prosperity",
    "Festive blessings! May happiness and success always be yours",
    "Tyohar ki haardik shubhkamnayein! Wishing you and your family joy and health",
  ],
};

// ─── Time-decay helpers ───────────────────────────────────────────────────────
// Exponential decay: half-life = ~140 days (ln(2)/0.00495 ≈ 140)
// A transaction from 6 months ago → ~0.74 weight; 1 year ago → ~0.17 weight.
// This means recent gifting behaviour dominates while old history informs.

const DECAY_LAMBDA = 0.00495;

function decayWeight(createdAt: Date | string): number {
  const daysAgo = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.exp(-DECAY_LAMBDA * Math.max(daysAgo, 0));
}

function computeDecayWeightedAvg(txList: Array<{ amount: string; createdAt: Date | string }>): number {
  if (txList.length === 0) return 0;
  let weightSum = 0;
  let valueSum = 0;
  for (const tx of txList) {
    const w = decayWeight(tx.createdAt);
    weightSum += w;
    valueSum += parseFloat(tx.amount) * w;
  }
  return weightSum > 0 ? valueSum / weightSum : 0;
}

// How old is the oldest included transaction in months?
function oldestTxMonths(txList: Array<{ createdAt: Date | string }>): number {
  if (txList.length === 0) return 0;
  const oldest = txList.reduce((a, b) =>
    new Date(a.createdAt) < new Date(b.createdAt) ? a : b
  );
  return (Date.now() - new Date(oldest.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
}

// ─── In-memory cache with TTL ────────────────────────────────────────────────

interface CacheEntry {
  data: AISuggestionResult;
  expiresAt: number;
}

const suggestionCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function getCached(key: string): AISuggestionResult | null {
  const entry = suggestionCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    suggestionCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: AISuggestionResult) {
  if (suggestionCache.size > 5000) {
    const now = Date.now();
    for (const [k, v] of suggestionCache) {
      if (now > v.expiresAt) suggestionCache.delete(k);
    }
  }
  suggestionCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RelationshipContext {
  totalGiven: number;
  totalReceived: number;
  transactionCount: number;
  lastAmounts: number[];          // most recent 5 amounts (plain, for trend detection)
  averageGiven: number;           // simple flat average (kept for display)
  decayWeightedAvg: number;       // NEW: exponentially time-weighted average
  reciprocityRatio: number;
  lastEventName: string | null;
  contactName: string;
  historySpanMonths: number;      // NEW: how many months of history we have
}

interface AmountDecision {
  primary: number;
  secondary: number;              // one tier above primary (explored for diversity)
  conservative: number;           // NEW: one tier below primary
  reasoning: string;
  confidenceLevel: "high" | "medium" | "low";
  signals: string[];
}

interface AISuggestionResult {
  suggestedAmount: number;
  alternativeAmount: number;
  conservativeAmount: number;     // NEW
  reasoning: string;
  suggestedMessages: string[];
  hasHistory: boolean;
  previouslyGiven: number;
  previouslyReceived: number;
  isAuspicious: boolean;
  auspiciousNote: string;
  confidenceLevel: "high" | "medium" | "low";
  signals: string[];
  aiVersion: string;              // NEW
}

// ─── Auspicious amount helpers ────────────────────────────────────────────────

function nearestAuspicious(base: number): number {
  const higher = SHAGUN_AMOUNTS.filter(a => a >= base);
  if (higher.length > 0) return higher[0];
  return SHAGUN_AMOUNTS[SHAGUN_AMOUNTS.length - 1];
}

/** Pick from the next 1–2 auspicious steps above `above` with controlled randomness.
 *  60% chance of the immediately next amount, 40% of the one after.
 *  This breaks the feedback loop: 100 users who all get the same primary will
 *  receive slightly different "alternative" nudges, preventing one amount from
 *  becoming the only social norm. */
function exploredSecondary(above: number): number {
  const higher = SHAGUN_AMOUNTS.filter(a => a > above);
  if (higher.length >= 2) return higher[Math.random() < 0.6 ? 0 : 1];
  if (higher.length === 1) return higher[0];
  return above;
}

/** One auspicious step below `below` — the conservative option. */
function previousAuspicious(below: number): number {
  const lower = SHAGUN_AMOUNTS.filter(a => a < below);
  if (lower.length > 0) return lower[lower.length - 1];
  return SHAGUN_AMOUNTS[0];
}

// ─── Rule engine ──────────────────────────────────────────────────────────────

function runRuleEngine(eventType: string, ctx: RelationshipContext | null): AmountDecision {
  const base = EVENT_BASE[eventType] ?? 251;
  const signals: string[] = [];

  if (!ctx || ctx.transactionCount === 0) {
    const primary = nearestAuspicious(base);
    return {
      primary,
      secondary: exploredSecondary(primary),
      conservative: previousAuspicious(primary),
      reasoning: `Standard starting amount for a ${eventType.replace("_", " ")}`,
      confidenceLevel: "low",
      signals: ["No prior history — using event-type default"],
    };
  }

  signals.push(`${ctx.transactionCount} past transaction${ctx.transactionCount > 1 ? "s" : ""} found`);

  // Time-decay signal — tell the user if old data is being discounted
  if (ctx.historySpanMonths > 6) {
    signals.push(`Recent gifts weighted more (history spans ~${Math.round(ctx.historySpanMonths)}m)`);
  }

  // Signal: reciprocity-first (they gave us, match it)
  if (ctx.totalReceived > 0 && ctx.totalGiven === 0) {
    const matchAmount = nearestAuspicious(Math.round(ctx.totalReceived * 0.9));
    signals.push(`Matched to ₹${ctx.totalReceived.toLocaleString("en-IN")} previously received from them`);
    return {
      primary: matchAmount,
      secondary: exploredSecondary(matchAmount),
      conservative: previousAuspicious(matchAmount),
      reasoning: `Matched to what ${ctx.contactName || "they"} previously gave you`,
      confidenceLevel: "high",
      signals,
    };
  }

  // Signal: trend (using plain last amounts — trend is directional, not magnitude)
  if (ctx.lastAmounts.length >= 2) {
    const oldest = ctx.lastAmounts[ctx.lastAmounts.length - 1];
    const latest = ctx.lastAmounts[0];
    if (latest > oldest) {
      signals.push(`Giving trend is upward (₹${oldest} → ₹${latest})`);
    } else if (latest < oldest) {
      signals.push(`Giving trend has slowed (₹${oldest} → ₹${latest})`);
    }
  }

  // Signal: reciprocity ratio
  if (ctx.totalGiven > 0 && ctx.totalReceived > 0) {
    const ratio = ctx.totalReceived / ctx.totalGiven;
    if (ratio >= 1.2) {
      signals.push(`Strong reciprocity — they return more than you give (ratio ${ratio.toFixed(1)}x)`);
    } else if (ratio >= 0.8) {
      signals.push("Balanced reciprocity with this family");
    } else {
      signals.push("You tend to give more than you receive from them");
    }
  }

  // Signal: relationship frequency
  if (ctx.transactionCount >= 5) {
    signals.push("Close/frequent gifting relationship");
  } else if (ctx.transactionCount >= 2) {
    signals.push("Regular gifting relationship");
  }

  // ── Core amount: use decay-weighted average as anchor instead of flat average
  // This automatically discounts stale 2019-era data and emphasises recent years.
  const anchor = ctx.decayWeightedAvg > 0
    ? ctx.decayWeightedAvg
    : (ctx.lastAmounts.length > 0 ? ctx.lastAmounts[0] : ctx.averageGiven);

  // Scale factor — frequency, reciprocity, wedding uplift
  let scaleFactor = 1.0;
  if (ctx.transactionCount >= 5) scaleFactor = 1.1;
  if (ctx.reciprocityRatio >= 1.2) scaleFactor += 0.05;
  if (eventType === "wedding" && ctx.transactionCount >= 3) scaleFactor += 0.1;

  const rawPrimary = Math.round(anchor * scaleFactor);
  const primary = nearestAuspicious(Math.max(rawPrimary, base));
  const secondary = exploredSecondary(primary);      // explored for bias correction
  const conservative = previousAuspicious(primary);  // conservative option always present

  let reasoning = "";
  if (ctx.lastAmounts.length > 0) {
    reasoning = `Based on your recent gift of ₹${ctx.lastAmounts[0].toLocaleString("en-IN")} to ${ctx.contactName || "them"}`;
    if (scaleFactor > 1.05) reasoning += " (scaled up for close relationship)";
  } else {
    reasoning = `Based on ₹${Math.round(ctx.decayWeightedAvg).toLocaleString("en-IN")} weighted average given to ${ctx.contactName || "them"}`;
  }

  return {
    primary,
    secondary,
    conservative,
    reasoning,
    confidenceLevel: ctx.transactionCount >= 3 ? "high" : "medium",
    signals,
  };
}

// ─── Claude: generate personalised messages ───────────────────────────────────

async function generateMessages(
  eventType: string,
  ctx: RelationshipContext | null,
  senderName: string,
  receiverName: string | null,
  amount: number,
): Promise<string[]> {
  const eventLabel = EVENT_LABELS[eventType] ?? eventType.replace("_", " ");
  const recipientLabel = receiverName ?? "the host";

  const historyLines = ctx && ctx.transactionCount > 0
    ? `- You have exchanged shagun ${ctx.transactionCount} time(s) with ${recipientLabel}
- You have given ₹${ctx.totalGiven.toLocaleString("en-IN")} and received ₹${ctx.totalReceived.toLocaleString("en-IN")} total
- Last event they attended was: ${ctx.lastEventName ?? "unknown"}`
    : `- This is your first shagun exchange with ${recipientLabel}`;

  const prompt = `You are writing heartfelt shagun (gift money) messages for an Indian gifting app.

Context:
- Sender's name: ${senderName}
- Recipient: ${recipientLabel}
- Occasion: ${eventLabel}
- Shagun amount being sent: ₹${amount.toLocaleString("en-IN")}
- Relationship history:
${historyLines}

Write exactly 4 short blessing messages in natural Hinglish (Hindi-English mix, as spoken in Indian families). Each message should:
- Be 1–2 sentences, warm and genuine
- Feel personal to THIS occasion and relationship (not generic)
- Use a Hindi phrase or word naturally embedded (not forced)
- End with a relevant emoji
- NOT repeat the same opening or phrasing across messages
- Reflect the amount sent (higher amounts = more celebratory tone)

Return ONLY a JSON array of 4 strings, no explanation, no markdown:
["message1", "message2", "message3", "message4"]`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content[0];
    if (block.type !== "text") throw new Error("Non-text response");

    const raw = block.text.trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON array in response");

    const parsed = JSON.parse(match[0]) as string[];
    if (!Array.isArray(parsed) || parsed.length < 2) throw new Error("Invalid array");

    return parsed.slice(0, 4);
  } catch (err: any) {
    logger.warn("Claude message generation failed — using fallback", { error: err.message, eventType });
    const bank = FALLBACK_MESSAGES[eventType] ?? FALLBACK_MESSAGES["wedding"];
    return [...bank].sort(() => Math.random() - 0.5).slice(0, 4);
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.get("/suggest", requireAuth, async (req: AuthRequest, res) => {
  const senderId = req.userId!;
  const { eventType, receiverId, receiverName, senderName, eventId } = req.query as {
    eventType: string;
    receiverId?: string;
    receiverName?: string;
    senderName?: string;
    eventId?: string;
  };

  if (!eventType) {
    return res.status(400).json({ error: "eventType is required" });
  }

  const cacheKey = `${senderId}:${receiverId ?? "none"}:${eventType}`;
  const cached = getCached(cacheKey);
  if (cached) {
    logger.info("AI suggest cache hit", { cacheKey, aiVersion: AI_VERSION });
    return res.json({ ...cached, fromCache: true });
  }

  // ── Fetch relationship context ─────────────────────────────────────────────

  let ctx: RelationshipContext | null = null;

  if (receiverId) {
    const [ledger] = await db.select().from(relationshipLedgerTable)
      .where(and(
        eq(relationshipLedgerTable.userId, senderId),
        eq(relationshipLedgerTable.contactId, receiverId),
      )).limit(1);

    // Fetch recent transactions WITH createdAt for time-decay computation
    const recentTx = await db.select({
      amount: transactionsTable.amount,
      createdAt: transactionsTable.createdAt,
    }).from(transactionsTable)
      .where(and(
        eq(transactionsTable.senderId, senderId),
        eq(transactionsTable.receiverId, receiverId),
      ))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(10);

    if (ledger || recentTx.length > 0) {
      const totalGiven = parseFloat(ledger?.totalGiven ?? "0");
      const totalReceived = parseFloat(ledger?.totalReceived ?? "0");
      const txCount = recentTx.length;
      const lastAmounts = recentTx.map(t => parseFloat(t.amount));
      const avgGiven = txCount > 0 ? totalGiven / Math.max(txCount, 1) : 0;
      const decayWeightedAvg = computeDecayWeightedAvg(recentTx);
      const historySpanMonths = oldestTxMonths(recentTx);

      ctx = {
        totalGiven,
        totalReceived,
        transactionCount: txCount,
        lastAmounts,
        averageGiven: avgGiven,
        decayWeightedAvg,
        reciprocityRatio: totalGiven > 0 ? totalReceived / totalGiven : 0,
        lastEventName: ledger?.lastEventName ?? null,
        contactName: receiverName ?? ledger?.contactName ?? "",
        historySpanMonths,
      };
    }
  }

  // ── Resolve sender name for Claude ────────────────────────────────────────

  let resolvedSenderName = senderName ?? "the sender";
  if (!senderName) {
    const [sender] = await db.select({ name: usersTable.name })
      .from(usersTable).where(eq(usersTable.id, senderId)).limit(1);
    if (sender) resolvedSenderName = sender.name;
  }

  // ── Run rule engine ───────────────────────────────────────────────────────

  const decision = runRuleEngine(eventType, ctx);

  // ── Generate personalised messages via Claude ─────────────────────────────

  const messages = await generateMessages(
    eventType,
    ctx,
    resolvedSenderName,
    receiverName ?? ctx?.contactName ?? null,
    decision.primary,
  );

  // ── Build response ────────────────────────────────────────────────────────

  const auspiciousNote = decision.primary % 100 === 1 || decision.primary % 10 === 1
    ? "Ends in 1 — auspicious in Indian tradition 🙏"
    : "A blessed shagun amount 🙏";

  const result: AISuggestionResult = {
    suggestedAmount: decision.primary,
    alternativeAmount: decision.secondary,
    conservativeAmount: decision.conservative,
    reasoning: decision.reasoning,
    suggestedMessages: messages,
    hasHistory: ctx !== null && ctx.transactionCount > 0,
    previouslyGiven: ctx?.totalGiven ?? 0,
    previouslyReceived: ctx?.totalReceived ?? 0,
    isAuspicious: true,
    auspiciousNote,
    confidenceLevel: decision.confidenceLevel,
    signals: decision.signals,
    aiVersion: AI_VERSION,
  };

  setCache(cacheKey, result);

  logger.info("AI suggest generated", {
    senderId,
    eventType,
    hasHistory: result.hasHistory,
    confidence: result.confidenceLevel,
    suggestedAmount: result.suggestedAmount,
    conservativeAmount: result.conservativeAmount,
    alternativeAmount: result.alternativeAmount,
    aiVersion: AI_VERSION,
  });

  return res.json(result);
});

export default router;
