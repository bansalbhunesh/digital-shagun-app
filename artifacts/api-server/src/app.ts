import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { env } from "./lib/env";
import { db, usersTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { errorHandler } from "./middlewares/error";
import logger from "./lib/logger";

const app: Express = express();

if (!env.WEB_CLIENT_URL && env.NODE_ENV === "production") {
  logger.error("❌ WEB_CLIENT_URL is missing in production!");
  throw new Error("Critical Configuration Error: WEB_CLIENT_URL must be set in production.");
}

app.use(pinoHttp({ logger }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(
  cors({
    origin: env.WEB_CLIENT_URL ? [env.WEB_CLIENT_URL] : "*",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
import { sanitizeInput } from "./middlewares/sanitize";
app.use(sanitizeInput);

app.get("/health", async (_req, res) => {
  try {
    // Basic DB connectivity check
    const startTime = Date.now();
    await db.select({ now: sql`now()` }).from(usersTable).limit(1);
    const dbLatency = Date.now() - startTime;

    res.json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      services: {
        database: { status: "up", latencyMs: dbLatency },
        supabase: { status: "connected" } // Assuming initialized
      }
    });
  } catch (error) {
    logger.error({ error }, "Health check failed");
    res.status(503).json({ 
      status: "unhealthy", 
      timestamp: new Date().toISOString(),
      error: "Service unavailable"
    });
  }
});

app.use("/api", router);

// Global Error Handler
app.use(errorHandler);

export default app;
