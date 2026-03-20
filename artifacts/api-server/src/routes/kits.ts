import { Router, type Request, type Response } from "express";
import { db, eventGiftsTable, eventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

import { generateId } from "../utils/id";
export const PREDEFINED_KITS = [
  {
    id: "home-setup-kit",
    name: "Home Setup Kit",
    emoji: "🏠",
    description: "Everything a new home needs to get started",
    eventTypes: ["housewarming", "wedding"],
    color: "#4A5C2A",
    totalAmount: 95000,
    items: [
      { name: "Smart TV (43\")", category: "Electronics", imageEmoji: "📺", targetAmount: 35000 },
      { name: "Washing Machine", category: "Appliances", imageEmoji: "🫧", targetAmount: 25000 },
      { name: "Microwave Oven", category: "Kitchen", imageEmoji: "📦", targetAmount: 8000 },
      { name: "Mixer Grinder", category: "Kitchen", imageEmoji: "🥣", targetAmount: 4500 },
      { name: "Pressure Cooker Set", category: "Kitchen", imageEmoji: "🫕", targetAmount: 3000 },
      { name: "Air Purifier", category: "Home", imageEmoji: "💨", targetAmount: 12000 },
      { name: "Water Purifier", category: "Health", imageEmoji: "💧", targetAmount: 7500 },
    ],
  },
  {
    id: "baby-essentials-kit",
    name: "Baby Essentials Kit",
    emoji: "👶",
    description: "Thoughtful must-haves for a new arrival",
    eventTypes: ["baby_ceremony"],
    color: "#8B5014",
    totalAmount: 42000,
    items: [
      { name: "Baby Cot & Mattress", category: "Furniture", imageEmoji: "🛏️", targetAmount: 12000 },
      { name: "Baby Monitor", category: "Safety", imageEmoji: "📡", targetAmount: 5000 },
      { name: "Pram / Stroller", category: "Transport", imageEmoji: "🛺", targetAmount: 8000 },
      { name: "Baby Food Maker", category: "Nutrition", imageEmoji: "🥣", targetAmount: 4500 },
      { name: "Baby Swing", category: "Comfort", imageEmoji: "🎠", targetAmount: 6500 },
      { name: "Diaper Bag", category: "Accessories", imageEmoji: "👜", targetAmount: 3000 },
      { name: "Baby Clothes Bundle", category: "Clothing", imageEmoji: "👕", targetAmount: 3000 },
    ],
  },
  {
    id: "wedding-starter-kit",
    name: "Wedding Starter Kit",
    emoji: "💍",
    description: "Start your married life with the best",
    eventTypes: ["wedding"],
    color: "#8B1A1A",
    totalAmount: 130000,
    items: [
      { name: "Refrigerator", category: "Appliances", imageEmoji: "🧊", targetAmount: 30000 },
      { name: "Bed & Mattress (King)", category: "Furniture", imageEmoji: "🛏️", targetAmount: 20000 },
      { name: "Dining Table Set", category: "Furniture", imageEmoji: "🪑", targetAmount: 18000 },
      { name: "Air Conditioner", category: "Appliances", imageEmoji: "❄️", targetAmount: 38000 },
      { name: "Honeymoon Fund", category: "Travel", imageEmoji: "✈️", targetAmount: 24000 },
    ],
  },
  {
    id: "birthday-celebration-kit",
    name: "Birthday Delight Kit",
    emoji: "🎂",
    description: "Make their birthday one to remember",
    eventTypes: ["birthday"],
    color: "#4A3080",
    totalAmount: 22000,
    items: [
      { name: "Gaming Console", category: "Entertainment", imageEmoji: "🎮", targetAmount: 12000 },
      { name: "Smart Watch", category: "Accessories", imageEmoji: "⌚", targetAmount: 6000 },
      { name: "Wireless Headphones", category: "Electronics", imageEmoji: "🎧", targetAmount: 4000 },
    ],
  },
  {
    id: "festival-home-kit",
    name: "Festival Home Kit",
    emoji: "🪔",
    description: "Deck up your home for celebrations",
    eventTypes: ["festival"],
    color: "#8B5014",
    totalAmount: 25000,
    items: [
      { name: "LED Festive Lights", category: "Décor", imageEmoji: "✨", targetAmount: 3000 },
      { name: "Pooja Thali Set (Silver)", category: "Spiritual", imageEmoji: "🪔", targetAmount: 5000 },
      { name: "Home Theatre System", category: "Entertainment", imageEmoji: "🔊", targetAmount: 12000 },
      { name: "Flower Decoration Fund", category: "Décor", imageEmoji: "🌸", targetAmount: 5000 },
    ],
  },
];

router.get("/", (req: Request, res: Response) => {
  const { eventType } = req.query as { eventType?: string };
  let kits = PREDEFINED_KITS;
  if (eventType) {
    kits = kits.filter(k => k.eventTypes.includes(eventType));
  }
  return res.json(kits);
});

router.post("/:eventId", requireAuth, async (req: Request, res: Response) => {
  const eventId = req.params.eventId as string;
  const { kitId } = req.body;
  const userId = req.user!.id;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.hostId !== userId) return res.status(403).json({ error: "Forbidden: Only the event host can add kits." });

  const kit = PREDEFINED_KITS.find(k => k.id === kitId);
  if (!kit) return res.status(404).json({ error: "Kit not found" });

  const existingGifts = await db.select().from(eventGiftsTable)
    .where(eq(eventGiftsTable.eventId, eventId));
  const existingNames = existingGifts.map(g => g.name);

  const addedGifts = [];
  for (const item of kit.items) {
    if (existingNames.includes(item.name)) continue;
    const id = generateId();
    const [gift] = await db.insert(eventGiftsTable).values({
      id, eventId,
      name: item.name,
      category: `${kit.name} • ${item.category}`,
      targetAmount: item.targetAmount.toString(),
      currentAmount: "0",
      imageEmoji: item.imageEmoji,
    }).returning();
    addedGifts.push({
      id: gift.id,
      name: gift.name,
      category: gift.category,
      targetAmount: parseFloat(gift.targetAmount),
      currentAmount: 0,
      imageEmoji: gift.imageEmoji,
      isFullyFunded: false,
    });
  }

  return res.status(201).json({
    kitId,
    kitName: kit.name,
    itemsAdded: addedGifts.length,
    gifts: addedGifts,
  });
});

export default router;
