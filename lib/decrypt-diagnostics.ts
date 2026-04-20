/**
 * Diagnostic helper for decrypt failures. Records the last N failures to
 * localStorage so the next time a user reports "복호화 실패", we can dump the
 * log and inspect real context (cryptoKey state, wrapper fingerprints, etc.)
 * instead of guessing.
 *
 * Dump in DevTools Console:
 *   JSON.parse(localStorage.getItem("bn_decrypt_fail_log"))
 */

const LOG_KEY = "bn_decrypt_fail_log";
const MAX_ENTRIES = 10;

export const LOCK_ERROR_MESSAGE = "App is locked";

export function isLockError(e: unknown): boolean {
  return e instanceof Error && e.message === LOCK_ERROR_MESSAGE;
}

type DecryptFailContext = {
  loadedWrapper?: string | null;
  currentWrapper?: string | null;
  ct?: string;
  kind?: string;
  id?: string;
};

export function logDecryptFailure(e: unknown, ctx: DecryptFailContext) {
  if (typeof window === "undefined") return;
  try {
    const entry = {
      ts: Date.now(),
      iso: new Date().toISOString(),
      error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      online: typeof navigator !== "undefined" ? navigator.onLine : null,
      visible:
        typeof document !== "undefined" ? document.visibilityState : null,
      ...ctx,
    };
    const prev = JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]");
    const next = [...prev.slice(-(MAX_ENTRIES - 1)), entry];
    localStorage.setItem(LOG_KEY, JSON.stringify(next));
    // Surface to console so user notices in DevTools immediately.
    console.warn("[decrypt-fail]", entry);
  } catch {
    // never throw from diagnostics
  }
}
