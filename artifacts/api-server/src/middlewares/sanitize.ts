import { Request, Response, NextFunction } from "express";

/**
 * Basic input sanitization middleware to strip common HTML tags.
 * For more robust protection, consider using a library like DOMPurify or xss.
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === "string") {
        req.body[key] = req.body[key].replace(/<[^>]*>?/gm, "");
      }
    }
  }
  next();
};
