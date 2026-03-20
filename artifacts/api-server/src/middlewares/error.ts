import { Request, Response, NextFunction } from "express";
import logger from "../lib/logger";

interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (err: AppError, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  logger.error(
    {
      err,
      method: req.method,
      url: req.url,
      userId: req.user?.id,
    },
    "Request failed"
  );

  res.status(statusCode).json({
    error: message,
    code: err.code || "INTERNAL_ERROR",
  });
};
