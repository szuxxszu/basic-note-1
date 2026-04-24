"use client";

import { useCallback, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { useCrypto } from "@/components/providers/crypto-provider";
import type { Note } from "@/lib/types";
import { syncPushEntity } from "@/lib/sync/engine";
import { looksLikeCiphertext } from "@/lib/crypto";
import { isLockError } from "@/lib/decrypt-diagnostics";
import { tr } from "@/lib/i18n";

export interface DecryptedNote extends Note {
  decryptedTitle: string;
  preview: string;
}

export function useNotes(categoryId?: string | null) {
  const { encryptText, decryptText, isUnlocked } = useCrypto();
  // Cache (ciphertext → plaintext) so list re-renders don't redecrypt every
  // title/preview on every DB change.
  const decryptCacheRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (!isUnlocked) decryptCacheRef.current.clear();
  }, [isUnlocked]);

  const rawNotes = useLiveQuery(
    async () => {
      const all = await db.notes.orderBy("updatedAt").reverse().toArray();
      const active = all.filter((n) => !n.deletedAt);
      const filtered = (categoryId !== undefined && categoryId !== null)
        ? active.filter((n) => n.categoryId === categoryId)
        : active;
      const pinned = filtered.filter((n) => n.pinned);
      const unpinned = filtered.filter((n) => !n.pinned);
      return [...pinned, ...unpinned];
    },
    [categoryId],
    [] as Note[]
  );

  const notes = useLiveQuery(
    async () => {
      if (!isUnlocked || !rawNotes || rawNotes.length === 0) return [];

      const cache = decryptCacheRef.current;

      const cachedDecrypt = async (ciphertext: string): Promise<string> => {
        const hit = cache.get(ciphertext);
        if (hit !== undefined) return hit;
        const text = await decryptText(ciphertext);
        cache.set(ciphertext, text);
        return text;
      };

      const decrypted = await Promise.all(
        rawNotes.map(async (note) => {
          let decryptedTitle = "";
          let preview = "";
          try {
            const title = await cachedDecrypt(note.title);
            decryptedTitle = looksLikeCiphertext(title) ? tr("lock.decryptFail") : title;
          } catch (e) {
            decryptedTitle = isLockError(e) ? "" : tr("lock.decryptFail");
          }

          try {
            if (note.content) {
              const raw = await cachedDecrypt(note.content);
              if (!looksLikeCiphertext(raw)) {
                let text = raw;
                if (/<[a-z][^>]*>/i.test(raw)) {
                  if (typeof document !== "undefined") {
                    const tpl = document.createElement("template");
                    tpl.innerHTML = raw;
                    text = tpl.content.textContent ?? "";
                  } else {
                    text = raw.replace(/<[^>]*>/g, " ");
                  }
                }
                for (const rawLine of text.split(/\n|\r/)) {
                  const line = rawLine.replace(/^( *)• /, "$1").trim();
                  if (!line) continue;
                  preview = line.length > 80 ? line.slice(0, 80) + "…" : line;
                  break;
                }
              }
            }
          } catch {
            preview = "";
          }

          return { ...note, decryptedTitle, preview } as DecryptedNote;
        })
      );
      return decrypted;
    },
    [rawNotes, isUnlocked],
    [] as DecryptedNote[]
  );

  const createNote = useCallback(
    async (categoryId: string | null = null): Promise<string | null> => {
      if (!isUnlocked) return null;

      const now = Date.now();
      const noteId = nanoid();
      const encryptedTitle = await encryptText("새 노트");
      const encryptedContent = await encryptText("");

      await db.notes.add({
        id: noteId,
        categoryId,
        title: encryptedTitle,
        content: encryptedContent,
        pinned: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      const note = await db.notes.get(noteId);
      if (note) syncPushEntity("note", note);

      return noteId;
    },
    [isUnlocked, encryptText]
  );

  const deleteNote = useCallback(async (id: string) => {
    const now = Date.now();
    await db.notes.update(id, { deletedAt: now, updatedAt: now });
    const deleted = await db.notes.get(id);
    if (deleted) syncPushEntity("note", deleted);
  }, []);

  const updateNoteTitle = useCallback(
    async (id: string, title: string) => {
      if (!isUnlocked) return;
      const encryptedTitle = await encryptText(title);
      await db.notes.update(id, {
        title: encryptedTitle,
        updatedAt: Date.now(),
      });
      const updated = await db.notes.get(id);
      if (updated) syncPushEntity("note", updated);
    },
    [isUnlocked, encryptText]
  );

  const togglePin = useCallback(async (id: string) => {
    const note = await db.notes.get(id);
    if (note) {
      await db.notes.update(id, {
        pinned: !note.pinned,
        updatedAt: Date.now(),
      });
      const updated = await db.notes.get(id);
      if (updated) syncPushEntity("note", updated);
    }
  }, []);

  const updateNoteDate = useCallback(async (id: string, date: number) => {
    await db.notes.update(id, {
      createdAt: date,
      updatedAt: Date.now(),
    });
    const updated = await db.notes.get(id);
    if (updated) syncPushEntity("note", updated);
  }, []);

  const moveToCategory = useCallback(async (noteId: string, categoryId: string | null) => {
    await db.notes.update(noteId, {
      categoryId,
      updatedAt: Date.now(),
    });
    const updated = await db.notes.get(noteId);
    if (updated) syncPushEntity("note", updated);
  }, []);

  return {
    notes: notes ?? [],
    createNote,
    deleteNote,
    updateNoteTitle,
    updateNoteDate,
    togglePin,
    moveToCategory,
  };
}
