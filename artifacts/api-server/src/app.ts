import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import router from "./routes";
import logger from "./lib/logger";

const API_VERSION = "1";
const APP_MIN_VERSION = "1";

const app: Express = express();

app.use(helmet());
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  exposedHeaders: ["X-API-Version", "X-App-Min-Version"],
}));

// Stamp every response with version headers so clients can detect API updates
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-API-Version", API_VERSION);
  res.setHeader("X-App-Min-Version", APP_MIN_VERSION);
  next();
});

// Structured request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logger[level](`${req.method} ${req.path}`, {
      status: res.statusCode,
      ms,
      ip: req.ip,
    });
  });
  next();
});

// Webhook route needs raw body for Razorpay signature verification
app.use("/api/payments/webhook", express.raw({ type: "*/*" }));

// All other routes get JSON parsing
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.path === "/api/payments/webhook") return next();
  express.json({ limit: "1mb" })(req, _res, next);
});
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
app.use("/api", limiter);

const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: "Too many OTP requests. Wait 1 minute." },
});
app.use("/api/otp", otpLimiter);

app.use("/api", router);

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error", { message: err.message, path: req.path, stack: err.stack });
  res.status(500).json({ error: "Internal server error. Please try again." });
});

export default app;
