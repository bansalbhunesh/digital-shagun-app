import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const AVATAR_COLORS = [
  "#8B0000", "#B8860B", "#6B2737", "#8B4513", "#556B2F",
  "#483D8B", "#2F4F4F", "#8B1A1A", "#704214", "#5C4033",
];

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

router.post("/", async (req, res) => {
  const { name, phone } = req.body;

  const existing = await db.select().from(usersTable).where(eq(usersTable.phone, phone)).limit(1);
  if (existing.length > 0) {
    const u = existing[0];
    return res.json({
      id: u.id,
      name: u.name,
      phone: u.phone,
      avatarColor: u.avatarColor,
      createdAt: u.createdAt.toISOString(),
    });
  }

  const id = generateId();
  const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  const [user] = await db.insert(usersTable).values({ id, name, phone, avatarColor }).returning();

  return res.json({
    id: user.id,
    name: user.name,
    phone: user.phone,
    avatarColor: user.avatarColor,
    createdAt: user.createdAt.toISOString(),
  });
});

router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({
    id: user.id,
    name: user.name,
    phone: user.phone,
    avatarColor: user.avatarColor,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
