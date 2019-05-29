/**
 * Logger
 * Define a custom Logger using winston
 */
import * as winston from "winston";
import { CONFIG } from "../Configuration";

export const logger = winston.createLogger({
  level: CONFIG,
  transports: [new winston.transports.Console()],
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(
      i => `${i.timestamp}: [${i.level.toUpperCase()}] ${i.message}`
    )
  )
});
