import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set in production — shutting down");
    }
    console.warn("[auth] WARNING: JWT_SECRET not set — using insecure dev fallback. Set it in environment secrets before deploying.");
    return "shagun-dev-only-change-before-production";
  }
  return secret;
}

export const JWT_SECRET = getJwtSecret();

export interface AuthRequest extends Request {
  userId?: string;
  userPhone?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required. Please log in." });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; phone: string };
    req.userId = payload.userId;
    req.userPhone = payload.phone;
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }
    return res.status(401).json({ error: "Invalid session. Please log in again." });
  }
}

export function signToken(userId: string, phone: string): string {
  return jwt.sign({ userId, phone }, JWT_SECRET, { expiresIn: "30d" });
}
