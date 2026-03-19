import { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase";



// Extend express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
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
    
    req.user = { id: data.user.id };
    next();
  } catch (err) {
    res.status(401).json({ error: "Internal server error during authentication" });
    return;
  }
};
