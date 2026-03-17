import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import eventsRouter from "./events";
import shagunRouter from "./shagun";
import giftsRouter from "./gifts";
import ledgerRouter from "./ledger";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/users", usersRouter);
router.use("/events", eventsRouter);
router.use("/shagun", shagunRouter);
router.use("/gifts", giftsRouter);
router.use("/ledger", ledgerRouter);

export default router;
