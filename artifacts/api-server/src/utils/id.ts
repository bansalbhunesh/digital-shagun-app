import { randomBytes } from "crypto";

export function generateId(): string {
  return `${Date.now()}_${randomBytes(4).toString("hex")}`;
}
