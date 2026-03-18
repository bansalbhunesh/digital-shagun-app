import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import router from "./routes";

const app: Express = express();

app.use(helmet());
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
}));

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
  console.error("[API Error]", err.message, err.stack);
  res.status(500).json({ error: "Internal server error. Please try again." });
});

export default app;
