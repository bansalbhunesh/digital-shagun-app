/**
 * Expo Push Notification sender.
 *
 * Uses the Expo Push API directly — no SDK needed, just HTTPS.
 * Tokens are stored in push_tokens table; this lib handles sending
 * and cleaning up invalid tokens automatically.
 */

import { db, pushTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import logger from "./logger";

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
}

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100; // Expo max per batch

function isValidExpoToken(token: string): boolean {
  return /^ExponentPushToken\[.+\]$/.test(token) || /^[a-zA-Z0-9_-]{22,}$/.test(token);
}

async function sendBatch(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    throw new Error(`Expo push API error: ${res.status}`);
  }

  const json = await res.json() as { data: ExpoTicket[] };
  return json.data;
}

/**
 * Send a push notification to all registered tokens for a user.
 * Silently skips if user has no tokens.
 */
export async function sendPushNotification(userId: string, message: PushMessage): Promise<void> {
  let tokens: string[] = [];

  try {
    const rows = await db.select({ token: pushTokensTable.token })
      .from(pushTokensTable)
      .where(eq(pushTokensTable.userId, userId));
    tokens = rows.map(r => r.token).filter(isValidExpoToken);
  } catch (err: any) {
    logger.error("Failed to fetch push tokens", { userId, error: err.message });
    return;
  }

  if (tokens.length === 0) return;

  const messages: ExpoMessage[] = tokens.map(token => ({
    to: token,
    title: message.title,
    body: message.body,
    data: message.data ?? {},
    sound: message.sound ?? "default",
    badge: message.badge,
    channelId: "default",
  }));

  // Send in chunks
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    try {
      const tickets = await sendBatch(chunk);

      // Remove invalid tokens automatically
      for (let j = 0; j < tickets.length; j++) {
        const ticket = tickets[j];
        if (ticket.status === "error") {
          const errCode = ticket.details?.error;
          if (errCode === "DeviceNotRegistered" || errCode === "InvalidCredentials") {
            const badToken = chunk[j].to;
            await db.delete(pushTokensTable)
              .where(eq(pushTokensTable.token, badToken))
              .catch(() => {});
            logger.info("Removed invalid push token", { userId, reason: errCode });
          } else {
            logger.warn("Push ticket error", { userId, error: ticket.message, code: errCode });
          }
        }
      }
    } catch (err: any) {
      logger.error("Push batch send failed", { userId, error: err.message });
    }
  }
}

/**
 * Send to multiple users at once (e.g. all event guests).
 */
export async function sendPushToMany(userIds: string[], message: PushMessage): Promise<void> {
  await Promise.allSettled(userIds.map(id => sendPushNotification(id, message)));
}
