import { Router } from "express";
import { db, relationshipLedgerTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

const EVENT_MESSAGES: Record<string, string[]> = {
  wedding: [
    "Shubh Vivah! May your life together be full of joy and prosperity 🙏",
    "Bahut Mubarak Ho! Wishing you a lifetime of happiness and love",
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
  ],
  festival: [
    "Festival ki bahut-bahut shubhkamnayein! May this season bring joy to all 🪔",
    "May this festive season fill your home with love, light, and prosperity",
    "Festive blessings! May happiness and success always be yours",
  ],
};

const SHAGUN_AMOUNTS = [
  101, 151, 201, 251, 301, 401, 501, 701, 1001, 1100, 1501, 2100, 3001, 5001, 7001, 11000,
];

function getAuspiciousAmount(base: number): number {
  const higher = SHAGUN_AMOUNTS.filter((a) => a >= base);
  return higher[0] ?? SHAGUN_AMOUNTS[SHAGUN_AMOUNTS.length - 1];
}

function suggestAmountForEvent(
  eventType: string,
  relationshipHistory: { totalGiven: number; totalReceived: number } | null
): {
  primary: number;
  secondary: number;
  reasoning: string;
} {
  const baseByEvent: Record<string, number> = {
    wedding: 501,
    baby_ceremony: 251,
    housewarming: 251,
    birthday: 101,
    festival: 101,
  };

  const base = baseByEvent[eventType] ?? 251;

  if (!relationshipHistory) {
    const primary = getAuspiciousAmount(base);
    const secondary = getAuspiciousAmount(primary + 200);
    return {
      primary,
      secondary,
      reasoning: `Standard amount for ${eventType.replace("_", " ")} celebrations`,
    };
  }

  const { totalGiven, totalReceived } = relationshipHistory;

  if (totalReceived > 0 && totalGiven === 0) {
    const suggested = getAuspiciousAmount(Math.round(totalReceived * 0.9));
    return {
      primary: suggested,
      secondary: getAuspiciousAmount(suggested + 200),
      reasoning: "Matched to what they previously gave you",
    };
  }

  if (totalGiven > 0) {
    const avg = totalGiven;
    const primary = getAuspiciousAmount(Math.round(avg * 1.1));
    const secondary = getAuspiciousAmount(primary + 200);
    return {
      primary,
      secondary,
      reasoning: "Based on your past gifting with this family",
    };
  }

  const primary = getAuspiciousAmount(base);
  const secondary = getAuspiciousAmount(primary + 200);
  return {
    primary,
    secondary,
    reasoning: "Recommended for this type of celebration",
  };
}

router.get("/suggest", requireAuth, async (req, res) => {
  const viewerId = req.user!.id;
  const { eventType, receiverId } = req.query as {
    eventType: string;
    receiverId: string;
  };

  if (!receiverId) return res.status(400).json({ error: "receiverId required" });

  let history = null;
  const [ledger] = await db
    .select()
    .from(relationshipLedgerTable)
    .where(
      and(
        eq(relationshipLedgerTable.userId, viewerId),
        eq(relationshipLedgerTable.contactId, receiverId)
      )
    )
    .limit(1);

  if (ledger) {
    history = {
      totalGiven: parseFloat(ledger.totalGiven ?? "0"),
      totalReceived: parseFloat(ledger.totalReceived ?? "0"),
    };
  }

  const amountSuggestion = suggestAmountForEvent(eventType, history);
  const messages = EVENT_MESSAGES[eventType] ?? EVENT_MESSAGES["wedding"];
  const shuffled = [...messages].sort(() => Math.random() - 0.5);

  return res.json({
    suggestedAmount: amountSuggestion.primary,
    alternativeAmount: amountSuggestion.secondary,
    reasoning: amountSuggestion.reasoning,
    suggestedMessages: shuffled.slice(0, 3),
    hasHistory: !!history,
    previouslyGiven: history?.totalGiven ?? 0,
    previouslyReceived: history?.totalReceived ?? 0,
    isAuspicious: true,
    auspiciousNote: "Ends in 1 — auspicious in Indian tradition 🙏",
  });
});

export default router;
