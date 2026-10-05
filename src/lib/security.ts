import { timingSafeEqual } from "node:crypto";
import type { Status } from "./types";
export function authorized(
  header: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || secret.length < 32 || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`),
    actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function validWebhook(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      ["discord.com", "discordapp.com"].includes(u.hostname) &&
      !u.port &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash &&
      /^\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(u.pathname)
    );
  } catch {
    return false;
  }
}
export function shouldAlert(
  before: Status | undefined,
  after: Status,
): boolean {
  return (
    !!before && before !== "unknown" && after !== "unknown" && before !== after
  );
}
