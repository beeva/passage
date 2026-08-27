import { createHmac, timingSafeEqual } from "node:crypto";

// Slack rejects (and recommends rejecting) anything older than this -
// without it, a captured request could be replayed indefinitely.
// https://api.slack.com/authentication/verifying-requests-from-slack
const MAX_REQUEST_AGE_SECONDS = 60 * 5;

/**
 * Implements Slack's documented request-signing scheme exactly: HMAC-
 * SHA256 of "v0:{timestamp}:{raw body}" using the app's signing secret,
 * compared against the X-Slack-Signature header - timing-safe, and only
 * after checking the timestamp isn't stale. The raw body matters: this
 * has to run on the exact bytes Slack sent, before any JSON/form parsing
 * that could reorder fields or normalize whitespace and silently produce
 * a different signature than the one actually sent.
 */
export function verifySlackRequest(signingSecret: string, timestamp: string, rawBody: string, signature: string): boolean {
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - timestampNumber);
  if (ageSeconds > MAX_REQUEST_AGE_SECONDS) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${createHmac("sha256", signingSecret).update(base).digest("hex")}`;

  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(signature, "utf8");
  if (expectedBuffer.length !== actualBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, actualBuffer);
}
