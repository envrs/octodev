/**
 * Logger utility using Pino
 */

import pino from "pino";

const isDev = process.env.ENVIRONMENT === "development" || process.env.NODE_ENV === "development";
const logLevel = process.env.LOG_LEVEL || "info";

export const logger = pino(
  {
    level: logLevel,
    transport: isDev
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            singleLine: false,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  }
);

export const createLogger = (name: string) => {
  return logger.child({ module: name });
};

export default logger;
