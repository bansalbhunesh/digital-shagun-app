import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import eventsRouter from "./events";
import shagunRouter from "./shagun";
import giftsRouter from "./gifts";
import kitsRouter from "./kits";
import paymentsRouter from "./payments";
import ledgerRouter from "./ledger";
import aiRouter from "./ai";
import docsRouter from "./docs";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/docs", docsRouter);
router.use("/users", usersRouter);
router.use("/events", eventsRouter);
router.use("/shagun", shagunRouter);
router.use("/gifts", giftsRouter);
router.use("/kits", kitsRouter);
router.use("/payments", paymentsRouter);
router.use("/ledger", ledgerRouter);
router.use("/ai", aiRouter);

export default router;
