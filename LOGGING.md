# Structured Logging Guide

The Digital Shagun API uses **Pino** for high-performance, structured JSON logging.

## Core Principles

1.  **JSON Format**: Logs are emitted as JSON, making them easy to parse by ELK stack, Datadog, or CloudWatch.
2.  **Contextual Data**: Always include relevant IDs (userId, eventId) in the log object rather than the message string.
3.  **Audit Trail**: Critical financial operations (shagun transfers) are logged with a specific `type: "SHAGUN_TRANSACTION"`.

## Usage

```typescript
import logger from "../lib/logger";

// Standard info log
logger.info({ userId: "123" }, "User logged in");

// Transaction log (Audit ready)
logger.info(
  {
    type: "SHAGUN_TRANSACTION",
    amount: 501,
    senderId: "...",
    receiverId: "...",
  },
  "Shagun transaction created"
);

// Error logging
logger.error({ err, path: req.path }, "API error occurred");
```

## Environment Config

- `LOG_LEVEL`: defaults to `info`. Set to `debug` for more verbosity or `warn` for production.
- `NODE_ENV`: set to `development` for pretty-printed logs in the console.
