import { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Simple in-memory cache for user profiles
const profileCache = new Map<string, { name: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
// Extend express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; name: string };
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    
    const cached = profileCache.get(data.user.id);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      req.user = { id: data.user.id, name: cached.name };
      return next();
    }

    const [userProfile] = await db.select().from(usersTable).where(eq(usersTable.id, data.user.id)).limit(1);
    if (!userProfile) {
      res.status(401).json({ error: "User profile not found" });
      return;
    }
    
    // Update cache
    profileCache.set(data.user.id, { name: userProfile.name, timestamp: Date.now() });

    req.user = { id: data.user.id, name: userProfile.name };
    next();
  } catch (err) {
    res.status(401).json({ error: "Internal server error during authentication" });
    return;
  }
};
