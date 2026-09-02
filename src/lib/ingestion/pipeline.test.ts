import { describe, expect, it, vi } from "vitest";
import { withTimeout } from "./pipeline";

describe("withTimeout", () => {
  it("resolves with the real value when the promise settles before the timeout", async () => {
    const fast = new Promise((resolve) => setTimeout(() => resolve("done"), 5));
    await expect(withTimeout(fast, 1000, "should not fire")).resolves.toBe("done");
  });

  it("rejects with the given message once the timeout elapses first", async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve("too late"), 200));
    await expect(withTimeout(slow, 10, "took too long")).rejects.toThrow("took too long");
  });

  it("propagates the real promise's own rejection when it rejects before the timeout", async () => {
    const failing = Promise.reject(new Error("real failure"));
    await expect(withTimeout(failing, 1000, "should not fire")).rejects.toThrow("real failure");
  });

  it("clears its internal timer once the real promise settles, rather than leaving it running", async () => {
    vi.useFakeTimers();
    try {
      const fast = Promise.resolve("done");
      await withTimeout(fast, 5000, "should not fire");
      // If the timer weren't cleared, advancing past it would still be
      // harmless here since the race already resolved - the real
      // assertion is that no unhandled rejection/timer warning occurs
      // when fake timers are torn down immediately after, which vitest
      // would otherwise surface as a leaked-timer warning.
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
