import { Router } from "express";
import { db, relationshipLedgerTable, transactionsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import logger from "../lib/logger";

const router = Router();

// ─── Constants ──────────────────────────────────────────────────────────────

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

// Fallback messages if Claude is unavailable
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
  // Evict oldest entries if cache grows large
  if (suggestionCache.size > 5000) {
    const now = Date.now();
    for (const [k, v] of suggestionCache) {
      if (now > v.expiresAt) suggestionCache.delete(k);
    }
  }
  suggestionCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface RelationshipContext {
  totalGiven: number;
  totalReceived: number;
  transactionCount: number;
  lastAmounts: number[];        // most recent 5 amounts given
  averageGiven: number;
  reciprocityRatio: number;     // totalReceived / totalGiven (>1 means they give more back)
  lastEventName: string | null;
  contactName: string;
}

interface AmountDecision {
  primary: number;
  secondary: number;
  reasoning: string;
  confidenceLevel: "high" | "medium" | "low";
  signals: string[];
}

interface AISuggestionResult {
  suggestedAmount: number;
  alternativeAmount: number;
  reasoning: string;
  suggestedMessages: string[];
  hasHistory: boolean;
  previouslyGiven: number;
  previouslyReceived: number;
  isAuspicious: boolean;
  auspiciousNote: string;
  confidenceLevel: "high" | "medium" | "low";
  signals: string[];
}

// ─── Helper: nearest auspicious amount ───────────────────────────────────────

function nearestAuspicious(base: number): number {
  const higher = SHAGUN_AMOUNTS.filter(a => a >= base);
  if (higher.length > 0) return higher[0];
  return SHAGUN_AMOUNTS[SHAGUN_AMOUNTS.length - 1];
}

function nextAuspicious(above: number): number {
  const higher = SHAGUN_AMOUNTS.filter(a => a > above);
  if (higher.length > 0) return higher[0];
  return above;
}

// ─── Rule engine: decide amount from signals ─────────────────────────────────

function runRuleEngine(eventType: string, ctx: RelationshipContext | null): AmountDecision {
  const base = EVENT_BASE[eventType] ?? 251;
  const signals: string[] = [];

  if (!ctx || ctx.transactionCount === 0) {
    const primary = nearestAuspicious(base);
    return {
      primary,
      secondary: nextAuspicious(primary),
      reasoning: `Standard starting amount for a ${eventType.replace("_", " ")}`,
      confidenceLevel: "low",
      signals: ["No prior history — using event-type default"],
    };
  }

  signals.push(`${ctx.transactionCount} past transaction${ctx.transactionCount > 1 ? "s" : ""} found`);

  // Signal 1: If they have given to us, match what they gave (reciprocity)
  if (ctx.totalReceived > 0 && ctx.totalGiven === 0) {
    const matchAmount = nearestAuspicious(Math.round(ctx.totalReceived * 0.9));
    signals.push(`Matched to ₹${ctx.totalReceived.toLocaleString("en-IN")} previously received from them`);
    return {
      primary: matchAmount,
      secondary: nextAuspicious(matchAmount),
      reasoning: `Matched to what ${ctx.contactName || "they"} previously gave you`,
      confidenceLevel: "high",
      signals,
    };
  }

  // Signal 2: Trend — is the user's giving amount growing?
  if (ctx.lastAmounts.length >= 2) {
    const oldest = ctx.lastAmounts[ctx.lastAmounts.length - 1];
    const latest = ctx.lastAmounts[0];
    if (latest > oldest) {
      signals.push(`Giving trend is upward (₹${oldest} → ₹${latest})`);
    } else if (latest < oldest) {
      signals.push(`Giving trend has slowed (₹${oldest} → ₹${latest})`);
    }
  }

  // Signal 3: Reciprocity — how much do they give back relative to you?
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

  // Signal 4: Frequency — close family vs distant
  if (ctx.transactionCount >= 5) {
    signals.push("Close/frequent gifting relationship");
  } else if (ctx.transactionCount >= 2) {
    signals.push("Regular gifting relationship");
  }

  // Core amount calculation
  // Use the most recent gift as anchor, not a flat average
  const anchor = ctx.lastAmounts.length > 0 ? ctx.lastAmounts[0] : ctx.averageGiven;

  // Scale up slightly for close relationships with strong reciprocity
  let scaleFactor = 1.0;
  if (ctx.transactionCount >= 5) scaleFactor = 1.1;
  if (ctx.reciprocityRatio >= 1.2) scaleFactor += 0.05;

  // For weddings, apply extra uplift if relationship is close
  if (eventType === "wedding" && ctx.transactionCount >= 3) scaleFactor += 0.1;

  const rawPrimary = Math.round(anchor * scaleFactor);
  const primary = nearestAuspicious(Math.max(rawPrimary, base));
  const secondary = nextAuspicious(primary);

  // Build a human-readable reasoning string
  let reasoning = "";
  if (ctx.lastAmounts.length > 0) {
    reasoning = `Based on your last gift of ₹${ctx.lastAmounts[0].toLocaleString("en-IN")} to ${ctx.contactName || "them"}`;
    if (scaleFactor > 1.05) reasoning += " (scaled up for close relationship)";
  } else {
    reasoning = `Based on ₹${ctx.averageGiven.toLocaleString("en-IN")} average given to ${ctx.contactName || "them"}`;
  }

  return {
    primary,
    secondary,
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
    // Extract JSON array even if Claude wraps it in extra text
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

// ─── Route ───────────────────────────────────────────────────────────────────

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

  // Cache key: specific to this sender–receiver–eventType combination
  const cacheKey = `${senderId}:${receiverId ?? "none"}:${eventType}`;
  const cached = getCached(cacheKey);
  if (cached) {
    logger.info("AI suggest cache hit", { cacheKey });
    return res.json({ ...cached, fromCache: true });
  }

  // ── Fetch relationship context ──────────────────────────────────────────

  let ctx: RelationshipContext | null = null;

  if (receiverId) {
    const [ledger] = await db.select().from(relationshipLedgerTable)
      .where(and(
        eq(relationshipLedgerTable.userId, senderId),
        eq(relationshipLedgerTable.contactId, receiverId),
      )).limit(1);

    // Fetch recent individual transactions for trend analysis
    const recentTx = await db.select().from(transactionsTable)
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

      ctx = {
        totalGiven,
        totalReceived,
        transactionCount: txCount,
        lastAmounts,
        averageGiven: avgGiven,
        reciprocityRatio: totalGiven > 0 ? totalReceived / totalGiven : 0,
        lastEventName: ledger?.lastEventName ?? null,
        contactName: receiverName ?? ledger?.contactName ?? "",
      };
    }
  }

  // ── Resolve sender's name for Claude ───────────────────────────────────

  let resolvedSenderName = senderName ?? "the sender";
  if (!senderName) {
    const [sender] = await db.select({ name: usersTable.name })
      .from(usersTable).where(eq(usersTable.id, senderId)).limit(1);
    if (sender) resolvedSenderName = sender.name;
  }

  // ── Run rule engine (synchronous, instant) ──────────────────────────────

  const decision = runRuleEngine(eventType, ctx);

  // ── Generate personalised messages via Claude (async) ───────────────────

  const messages = await generateMessages(
    eventType,
    ctx,
    resolvedSenderName,
    receiverName ?? ctx?.contactName ?? null,
    decision.primary,
  );

  // ── Build and cache response ────────────────────────────────────────────

  const auspiciousNote = decision.primary % 100 === 1 || decision.primary % 10 === 1
    ? "Ends in 1 — auspicious in Indian tradition 🙏"
    : "A blessed shagun amount 🙏";

  const result: AISuggestionResult = {
    suggestedAmount: decision.primary,
    alternativeAmount: decision.secondary,
    reasoning: decision.reasoning,
    suggestedMessages: messages,
    hasHistory: ctx !== null && ctx.transactionCount > 0,
    previouslyGiven: ctx?.totalGiven ?? 0,
    previouslyReceived: ctx?.totalReceived ?? 0,
    isAuspicious: true,
    auspiciousNote,
    confidenceLevel: decision.confidenceLevel,
    signals: decision.signals,
  };

  setCache(cacheKey, result);

  logger.info("AI suggest generated", {
    senderId,
    eventType,
    hasHistory: result.hasHistory,
    confidence: result.confidenceLevel,
    suggestedAmount: result.suggestedAmount,
  });

  return res.json(result);
});

export default router;
