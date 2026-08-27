import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySlackRequest } from "./verify";

const SIGNING_SECRET = "8f742231b10e8888abcd99yyyzzz85a5";

/** Computes a real signature the exact way verifySlackRequest expects to receive one - independent of the implementation under test, the same reasoning as the webhook HMAC tests elsewhere in this project. */
function realSignature(secret: string, timestamp: string, rawBody: string): string {
  return `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
}

function freshTimestamp(): string {
  return String(Math.floor(Date.now() / 1000));
}

describe("verifySlackRequest", () => {
  it("accepts a genuinely valid, freshly-timestamped signature", () => {
    const timestamp = freshTimestamp();
    const body = "token=abc&team_id=T123&command=%2Fask&text=how+many+vacation+days";
    const signature = realSignature(SIGNING_SECRET, timestamp, body);
    expect(verifySlackRequest(SIGNING_SECRET, timestamp, body, signature)).toBe(true);
  });

  it("rejects a signature computed with the wrong signing secret", () => {
    const timestamp = freshTimestamp();
    const body = "token=abc&team_id=T123";
    const signature = realSignature("a-different-secret", timestamp, body);
    expect(verifySlackRequest(SIGNING_SECRET, timestamp, body, signature)).toBe(false);
  });

  it("rejects when the body was tampered with after signing", () => {
    const timestamp = freshTimestamp();
    const signature = realSignature(SIGNING_SECRET, timestamp, "text=original");
    expect(verifySlackRequest(SIGNING_SECRET, timestamp, "text=tampered", signature)).toBe(false);
  });

  it("rejects a stale timestamp even with an otherwise-correct signature", () => {
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 60 * 10); // 10 minutes old
    const body = "token=abc";
    const signature = realSignature(SIGNING_SECRET, staleTimestamp, body);
    expect(verifySlackRequest(SIGNING_SECRET, staleTimestamp, body, signature)).toBe(false);
  });

  it("rejects a timestamp from the future the same way (clock skew shouldn't be exploitable either direction)", () => {
    const futureTimestamp = String(Math.floor(Date.now() / 1000) + 60 * 10);
    const body = "token=abc";
    const signature = realSignature(SIGNING_SECRET, futureTimestamp, body);
    expect(verifySlackRequest(SIGNING_SECRET, futureTimestamp, body, signature)).toBe(false);
  });

  it("rejects a non-numeric timestamp instead of throwing", () => {
    expect(verifySlackRequest(SIGNING_SECRET, "not-a-timestamp", "body", "v0=whatever")).toBe(false);
  });

  it("rejects a malformed signature of a completely different length instead of throwing", () => {
    const timestamp = freshTimestamp();
    expect(verifySlackRequest(SIGNING_SECRET, timestamp, "body", "v0=short")).toBe(false);
  });

  it("rejects an empty signature instead of throwing", () => {
    const timestamp = freshTimestamp();
    expect(verifySlackRequest(SIGNING_SECRET, timestamp, "body", "")).toBe(false);
  });
});
