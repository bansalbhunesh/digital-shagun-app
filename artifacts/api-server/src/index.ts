import app from "./app";
import { initSentry } from "./lib/sentry";
import { env } from "./lib/env";
import logger from "./lib/logger";

initSentry();

const port = env.PORT;

app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
});
