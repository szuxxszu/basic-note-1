"use client";

import { useCallback, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useCrypto } from "@/components/providers/crypto-provider";
import { syncPushEntity } from "@/lib/sync/engine";
import { looksLikeCiphertext } from "@/lib/crypto";
import { isLockError } from "@/lib/decrypt-diagnostics";

/**
 * Apple Notes-style plain editor.
 * Single contentEditable, smart bullet continuation on Enter, Tab for indent.
 * Storage: one encrypted plaintext string per note (note.content).
 */

const BULLET = "• ";

interface PlainEditorProps {
  noteId: string;
}

// Read caret offset (as string index) within an element that only contains
// plaintext (we use contentEditable=plaintext-only to guarantee this).
function getCaretOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.endContainer)) return 0;
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

function setCaretToOffset(el: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node: Node | null = walker.nextNode();
  if (!node) {
    // Empty element — place caret inside
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    return;
  }
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (remaining <= len) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= len;
    node = walker.nextNode();
  }
  // Fallback: end of element
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

interface LineInfo {
  lineStart: number;
  lineEnd: number;
  line: string;
  bulletIndent: number | null; // leading spaces count if line is "  • ...", else null
}

function getLineInfo(text: string, offset: number): LineInfo {
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  const nextNl = text.indexOf("\n", offset);
  const lineEnd = nextNl === -1 ? text.length : nextNl;
  const line = text.slice(lineStart, lineEnd);
  const match = line.match(/^( *)• /);
  const bulletIndent = match ? match[1].length : null;
  return { lineStart, lineEnd, line, bulletIndent };
}

async function migrateFromBlocks(
  noteId: string,
  decrypt: (s: string) => Promise<string>
): Promise<string> {
  const blocks = await db.blocks
    .where("[noteId+sortOrder]")
    .between([noteId, ""], [noteId, "\uffff"])
    .toArray();
  const active = blocks.filter((b) => !b.deletedAt);
  const lines: string[] = [];
  for (const block of active) {
    let text = "";
    if (block.content) {
      try {
        text = await decrypt(block.content);
        if (looksLikeCiphertext(text)) text = "";
      } catch {
        text = "";
      }
    }
    const indent = Math.max(0, block.indent || 0);
    const prefix = " ".repeat(indent * 2);
    switch (block.type) {
      case "bullet":
      case "todo":
      case "numbered":
        lines.push(prefix + BULLET + text);
        break;
      case "heading":
        lines.push(text);
        break;
      case "divider":
        lines.push("—");
        break;
      case "quote":
      case "code":
      case "text":
      default:
        lines.push(prefix + text);
        break;
    }
  }
  return lines.join("\n");
}

export function PlainEditor({ noteId }: PlainEditorProps) {
  const { encryptText, decryptText, isUnlocked } = useCrypto();
  const note = useLiveQuery(() => db.notes.get(noteId), [noteId]);
  const ref = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedForRef = useRef<string | null>(null);
  const latestTextRef = useRef<string>("");

  const saveSoon = useCallback(
    (text: string) => {
      latestTextRef.current = text;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          const encrypted = await encryptText(text);
          await db.notes.update(noteId, {
            content: encrypted,
            updatedAt: Date.now(),
          });
          const updated = await db.notes.get(noteId);
          if (updated) syncPushEntity("note", updated);
        } catch (e) {
          console.error("[PlainEditor] save failed:", e);
        }
      }, 400);
    },
    [encryptText, noteId]
  );

  // Load / migrate when note or unlock state changes.
  useEffect(() => {
    if (!isUnlocked || !note || !ref.current) return;
    if (loadedForRef.current === noteId) return;
    loadedForRef.current = noteId;

    let cancelled = false;
    (async () => {
      let plaintext = "";
      if (note.content) {
        try {
          const decrypted = await decryptText(note.content);
          plaintext = looksLikeCiphertext(decrypted) ? "" : decrypted;
        } catch (e) {
          if (!isLockError(e)) {
            plaintext = "";
          }
        }
      } else {
        // Migrate from the old block-based model.
        plaintext = await migrateFromBlocks(noteId, decryptText);
        if (plaintext) {
          try {
            const encrypted = await encryptText(plaintext);
            await db.notes.update(noteId, {
              content: encrypted,
              updatedAt: Date.now(),
            });
            const updated = await db.notes.get(noteId);
            if (updated) syncPushEntity("note", updated);
          } catch {}
        }
      }
      if (cancelled || !ref.current) return;
      if (ref.current.textContent !== plaintext) {
        ref.current.textContent = plaintext;
      }
      latestTextRef.current = plaintext;
    })();

    return () => {
      cancelled = true;
    };
  }, [noteId, isUnlocked, note, decryptText, encryptText]);

  // Flush pending save when unmounting or switching notes.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [noteId]);

  const handleInput = useCallback(() => {
    if (!ref.current) return;
    const text = ref.current.textContent ?? "";
    saveSoon(text);
  }, [saveSoon]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;

      if (e.key === "Enter" && !e.shiftKey) {
        const offset = getCaretOffset(el);
        const text = el.textContent ?? "";
        const { lineStart, line, bulletIndent } = getLineInfo(text, offset);

        if (bulletIndent !== null) {
          const bulletEnd = lineStart + bulletIndent + BULLET.length;
          const caretOnEmptyBullet =
            offset === bulletEnd && line.length === bulletIndent + BULLET.length;

          if (caretOnEmptyBullet) {
            // Empty bullet → exit bullet mode (clear this line's marker).
            e.preventDefault();
            const newText = text.slice(0, lineStart) + text.slice(lineStart + line.length);
            el.textContent = newText;
            setCaretToOffset(el, lineStart);
            saveSoon(newText);
            return;
          }

          e.preventDefault();
          const indent = " ".repeat(bulletIndent);
          const insert = `\n${indent}${BULLET}`;
          const newText = text.slice(0, offset) + insert + text.slice(offset);
          el.textContent = newText;
          setCaretToOffset(el, offset + insert.length);
          saveSoon(newText);
          return;
        }
        // Non-bullet line — browser default line break is fine (plaintext-only).
      }

      if (e.key === "Tab") {
        const offset = getCaretOffset(el);
        const text = el.textContent ?? "";
        const { lineStart, bulletIndent } = getLineInfo(text, offset);
        if (bulletIndent !== null) {
          e.preventDefault();
          if (e.shiftKey) {
            if (bulletIndent >= 2) {
              const newText = text.slice(0, lineStart) + text.slice(lineStart + 2);
              el.textContent = newText;
              setCaretToOffset(el, Math.max(lineStart, offset - 2));
              saveSoon(newText);
            }
          } else {
            const newText = text.slice(0, lineStart) + "  " + text.slice(lineStart);
            el.textContent = newText;
            setCaretToOffset(el, offset + 2);
            saveSoon(newText);
          }
          return;
        }
        // Plain line Tab: insert 2 spaces (simple indent).
        e.preventDefault();
        const newText = text.slice(0, offset) + "  " + text.slice(offset);
        el.textContent = newText;
        setCaretToOffset(el, offset + 2);
        saveSoon(newText);
      }

      if (e.key === "Backspace") {
        const offset = getCaretOffset(el);
        const text = el.textContent ?? "";
        const { lineStart, bulletIndent } = getLineInfo(text, offset);
        if (bulletIndent !== null) {
          const bulletEnd = lineStart + bulletIndent + BULLET.length;
          // Caret right after the bullet marker → remove the marker.
          if (offset === bulletEnd) {
            const sel = window.getSelection();
            if (!sel?.isCollapsed) return;
            e.preventDefault();
            const newText =
              text.slice(0, lineStart) +
              text.slice(lineStart).replace(/^( *)• /, "$1");
            el.textContent = newText;
            setCaretToOffset(el, offset - BULLET.length);
            saveSoon(newText);
            return;
          }
        }
      }
    },
    [saveSoon]
  );

  // Fallback prop type: not every browser officially types "plaintext-only".
  const contentEditableAttr = "plaintext-only" as unknown as boolean;

  return (
    <div
      ref={ref}
      contentEditable={contentEditableAttr}
      suppressContentEditableWarning
      className="outline-none leading-relaxed text-foreground whitespace-pre-wrap min-h-[50vh]"
      onInput={handleInput}
      onKeyDown={handleKeyDown}
    />
  );
}
