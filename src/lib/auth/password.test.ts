import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("hashPassword", () => {
  it("returns a salt:hash pair, both hex", async () => {
    const stored = await hashPassword("correct horse battery staple");
    const [salt, hash] = stored.split(":");
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).toMatch(/^[0-9a-f]{128}$/);
  });

  it("uses a different random salt each call, even for the same password", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
  });
});

describe("verifyPassword", () => {
  it("accepts the correct password against its own hash", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("wrong password", stored)).toBe(false);
  });

  it("is case-sensitive", async () => {
    const stored = await hashPassword("Password123");
    expect(await verifyPassword("password123", stored)).toBe(false);
  });

  it("rejects a stored value with no salt:hash separator instead of throwing", async () => {
    await expect(verifyPassword("anything", "not-a-valid-stored-hash")).resolves.toBe(false);
  });

  it("rejects an empty stored value instead of throwing", async () => {
    await expect(verifyPassword("anything", "")).resolves.toBe(false);
  });

  it("rejects a stored hash of the wrong length instead of throwing", async () => {
    await expect(verifyPassword("anything", "deadbeef:abcd")).resolves.toBe(false);
  });
});
