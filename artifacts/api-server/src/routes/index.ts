import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import eventsRouter from "./events";
import shagunRouter from "./shagun";
import giftsRouter from "./gifts";
import kitsRouter from "./kits";
import ledgerRouter from "./ledger";
import aiRouter from "./ai";
import otpRouter from "./otp";
import paymentsRouter from "./payments";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/users", usersRouter);
router.use("/events", eventsRouter);
router.use("/shagun", shagunRouter);
router.use("/gifts", giftsRouter);
router.use("/kits", kitsRouter);
router.use("/ledger", ledgerRouter);
router.use("/ai", aiRouter);
router.use("/otp", otpRouter);
router.use("/payments", paymentsRouter);

export default router;
