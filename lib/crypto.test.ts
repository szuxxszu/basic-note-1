import { describe, it, expect } from "vitest";
import {
  encrypt,
  decrypt,
  looksLikeCiphertext,
  generateMasterKey,
  exportMasterKey,
  importMasterKey,
  wrapMasterKey,
  unwrapMasterKey,
  generateRecoveryKey,
  normalizeRecoveryKey,
  createMasterKeySetup,
  verifyAndUnwrapMasterKey,
  verifyPasswordLegacy,
  recoverMasterKey,
  rewrapMasterKey,
  deriveKey,
} from "./crypto";

describe("encrypt / decrypt", () => {
  it("round-trips a plaintext", async () => {
    const key = await generateMasterKey();
    const ct = await encrypt(key, "hello world");
    expect(await decrypt(key, ct)).toBe("hello world");
  });

  it("produces different ciphertexts for the same plaintext (random IV)", async () => {
    const key = await generateMasterKey();
    const a = await encrypt(key, "same");
    const b = await encrypt(key, "same");
    expect(a).not.toBe(b);
    expect(await decrypt(key, a)).toBe("same");
    expect(await decrypt(key, b)).toBe("same");
  });

  it("throws when decrypting with a different key", async () => {
    const k1 = await generateMasterKey();
    const k2 = await generateMasterKey();
    const ct = await encrypt(k1, "secret");
    await expect(decrypt(k2, ct)).rejects.toThrow();
  });

  it("handles unicode and empty strings", async () => {
    const key = await generateMasterKey();
    expect(await decrypt(key, await encrypt(key, ""))).toBe("");
    expect(await decrypt(key, await encrypt(key, "한글 🔐 emoji"))).toBe(
      "한글 🔐 emoji"
    );
  });
});

describe("looksLikeCiphertext", () => {
  it("returns true for our own ciphertext output", async () => {
    const key = await generateMasterKey();
    const ct = await encrypt(key, "x");
    expect(looksLikeCiphertext(ct)).toBe(true);
  });

  it("returns false for short or non-base64 strings", () => {
    expect(looksLikeCiphertext("hi")).toBe(false);
    expect(looksLikeCiphertext("not-base64!@#$")).toBe(false);
    expect(looksLikeCiphertext("plain text content")).toBe(false);
  });

  it("returns false for length not multiple of 4", () => {
    expect(looksLikeCiphertext("A".repeat(41))).toBe(false);
  });
});

describe("master key export / import / wrap / unwrap", () => {
  it("exports and re-imports preserving identity", async () => {
    const key = await generateMasterKey();
    const exported = await exportMasterKey(key);
    const reimported = await importMasterKey(exported);
    const ct = await encrypt(key, "payload");
    expect(await decrypt(reimported, ct)).toBe("payload");
  });

  it("wraps and unwraps with a wrapping key", async () => {
    const masterKey = await generateMasterKey();
    const wrappingKey = await generateMasterKey();
    const wrapped = await wrapMasterKey(masterKey, wrappingKey);
    const unwrapped = await unwrapMasterKey(wrapped, wrappingKey);
    const ct = await encrypt(masterKey, "via-wrapped");
    expect(await decrypt(unwrapped, ct)).toBe("via-wrapped");
  });

  it("unwrap throws with wrong wrapping key", async () => {
    const masterKey = await generateMasterKey();
    const correct = await generateMasterKey();
    const wrong = await generateMasterKey();
    const wrapped = await wrapMasterKey(masterKey, correct);
    await expect(unwrapMasterKey(wrapped, wrong)).rejects.toThrow();
  });
});

describe("recovery key format", () => {
  it("produces 8 groups of 4 uppercase hex chars (16 bytes total)", () => {
    const key = generateRecoveryKey();
    expect(key).toMatch(
      /^[0-9A-F]{4}(-[0-9A-F]{4}){7}$/
    );
    expect(normalizeRecoveryKey(key)).toHaveLength(32);
  });

  it("normalizes by stripping dashes and uppercasing", () => {
    expect(normalizeRecoveryKey("abcd-1234-ef56-7890-aaaa-bbbb-cccc-dddd")).toBe(
      "ABCD1234EF567890AAAABBBBCCCCDDDD"
    );
  });

  it("two consecutive generations are distinct", () => {
    expect(generateRecoveryKey()).not.toBe(generateRecoveryKey());
  });
});

describe("createMasterKeySetup → verifyAndUnwrapMasterKey end-to-end", () => {
  it("password unlock recovers the same master key", async () => {
    const setup = await createMasterKeySetup("correct-horse");
    const unlocked = await verifyAndUnwrapMasterKey(
      "correct-horse",
      setup.salt,
      setup.verifier,
      setup.encryptedMasterKey
    );
    expect(unlocked).not.toBeNull();

    // Encrypt with original master key, decrypt with unlocked key.
    const ct = await encrypt(setup.masterKey, "secret-content");
    expect(await decrypt(unlocked!, ct)).toBe("secret-content");
  }, 30_000);

  it("wrong password returns null without throwing", async () => {
    const setup = await createMasterKeySetup("right");
    const unlocked = await verifyAndUnwrapMasterKey(
      "wrong",
      setup.salt,
      setup.verifier,
      setup.encryptedMasterKey
    );
    expect(unlocked).toBeNull();
  }, 30_000);

  it("recoveryKey unlocks the same master key", async () => {
    const setup = await createMasterKeySetup("pw");
    const recovered = await recoverMasterKey(
      setup.recoveryKey,
      setup.recoverySalt,
      setup.recoveryEncryptedMasterKey
    );
    expect(recovered).not.toBeNull();
    const ct = await encrypt(setup.masterKey, "via-recovery");
    expect(await decrypt(recovered!, ct)).toBe("via-recovery");
  }, 30_000);

  it("rewrapMasterKey allows unlock with new password but not old", async () => {
    const setup = await createMasterKeySetup("old-pw");
    const rewrapped = await rewrapMasterKey(setup.masterKey, "new-pw");

    const okWithNew = await verifyAndUnwrapMasterKey(
      "new-pw",
      rewrapped.salt,
      rewrapped.verifier,
      rewrapped.encryptedMasterKey
    );
    expect(okWithNew).not.toBeNull();

    const failsWithOld = await verifyAndUnwrapMasterKey(
      "old-pw",
      rewrapped.salt,
      rewrapped.verifier,
      rewrapped.encryptedMasterKey
    );
    expect(failsWithOld).toBeNull();
  }, 60_000);
});

describe("verifyPasswordLegacy", () => {
  it("returns the wrapping key on correct password and null on wrong", async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const wrappingKey = await deriveKey("legacy-pw", salt);
    const verifier = await encrypt(wrappingKey, "SecureNote-verified");
    const saltB64 = btoa(String.fromCharCode(...salt));

    const ok = await verifyPasswordLegacy("legacy-pw", saltB64, verifier);
    expect(ok).not.toBeNull();

    const bad = await verifyPasswordLegacy("nope", saltB64, verifier);
    expect(bad).toBeNull();
  }, 30_000);
});
