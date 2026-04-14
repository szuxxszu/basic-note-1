import { ENCRYPTION_ITERATIONS, VERIFIER_PLAINTEXT } from "./constants";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ─── Key Derivation ──────────────────────────────────────────

async function getKeyMaterial(password: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
}

export async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const keyMaterial = await getKeyMaterial(password);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: ENCRYPTION_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ─── Encrypt / Decrypt ───────────────────────────────────────

export async function encrypt(
  key: CryptoKey,
  plaintext: string
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );
  // Concat iv + ciphertext → base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(
  key: CryptoKey,
  encrypted: string
): Promise<string> {
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return decoder.decode(plaintext);
}

// ─── Setup & Verify ──────────────────────────────────────────

export async function createEncryptionSetup(password: string): Promise<{
  salt: string;
  verifier: string;
  key: CryptoKey;
}> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  const verifier = await encrypt(key, VERIFIER_PLAINTEXT);
  return {
    salt: btoa(String.fromCharCode(...salt)),
    verifier,
    key,
  };
}

export async function verifyPassword(
  password: string,
  saltBase64: string,
  verifier: string
): Promise<CryptoKey | null> {
  try {
    const salt = Uint8Array.from(atob(saltBase64), (c) => c.charCodeAt(0));
    const key = await deriveKey(password, salt);
    const decrypted = await decrypt(key, verifier);
    if (decrypted === VERIFIER_PLAINTEXT) return key;
    return null;
  } catch {
    return null;
  }
}
