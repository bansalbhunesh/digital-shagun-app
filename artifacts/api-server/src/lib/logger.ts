import winston from "winston";

const isProd = process.env.NODE_ENV === "production";

const logger = winston.createLogger({
  level: isProd ? "info" : "debug",
  format: isProd
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      )
    : winston.format.combine(
        winston.format.timestamp({ format: "HH:mm:ss" }),
        winston.format.errors({ stack: true }),
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const extras = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
          return `${timestamp} [${level}] ${message}${extras}`;
        }),
      ),
  transports: [new winston.transports.Console()],
});

export default logger;
