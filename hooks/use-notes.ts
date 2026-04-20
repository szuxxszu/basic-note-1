"use client";

import { useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { useCrypto } from "@/components/providers/crypto-provider";
import { getOrderBetween } from "@/lib/fractional-index";
import type { Note, Block } from "@/lib/types";
import { syncPushEntity } from "@/lib/sync/engine";
import { looksLikeCiphertext } from "@/lib/crypto";
import { isLockError } from "@/lib/decrypt-diagnostics";
import { tr } from "@/lib/i18n";

export interface DecryptedNote extends Note {
  /** Decrypted title */
  decryptedTitle: string;
  /** Preview text from first block */
  preview: string;
}

export function useNotes(categoryId?: string | null) {
  const { encryptText, decryptText, isUnlocked } = useCrypto();

  const rawNotes = useLiveQuery(
    async () => {
      const all = await db.notes.orderBy("updatedAt").reverse().toArray();
      const active = all.filter((n) => !n.deletedAt);
      const filtered = (categoryId !== undefined && categoryId !== null)
        ? active.filter((n) => n.categoryId === categoryId)
        : active;
      // Pinned notes always on top
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

      const decrypted = await Promise.all(
        rawNotes.map(async (note) => {
          let decryptedTitle = "";
          let preview = "";
          try {
            const title = await decryptText(note.title);
            decryptedTitle = looksLikeCiphertext(title) ? tr("lock.decryptFail") : title;
          } catch (e) {
            decryptedTitle = isLockError(e) ? "" : tr("lock.decryptFail");
          }

          // Get first text block for preview
          try {
            const blocks = await db.blocks
              .where("[noteId+sortOrder]")
              .between([note.id, ""], [note.id, "\uffff"])
              .limit(1)
              .toArray();
            if (blocks.length > 0 && blocks[0].content) {
              const text = await decryptText(blocks[0].content);
              preview = looksLikeCiphertext(text) ? "" : text;
              if (preview.length > 80) preview = preview.slice(0, 80) + "…";
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

      await db.transaction("rw", db.notes, db.blocks, async () => {
        await db.notes.add({
          id: noteId,
          categoryId,
          title: encryptedTitle,
          pinned: false,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        });

        // Create initial empty text block
        await db.blocks.add({
          id: nanoid(),
          noteId,
          type: "text",
          content: encryptedContent,
          indent: 0,
          sortOrder: getOrderBetween(null, null),
          meta: {},
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        });
      });

      // Sync note and block to remote
      const note = await db.notes.get(noteId);
      if (note) syncPushEntity("note", note);
      const block = await db.blocks.where("noteId").equals(noteId).first();
      if (block) syncPushEntity("block", block);

      return noteId;
    },
    [isUnlocked, encryptText]
  );

  const deleteNote = useCallback(async (id: string) => {
    const now = Date.now();
    await db.transaction("rw", db.notes, db.blocks, async () => {
      await db.notes.update(id, { deletedAt: now, updatedAt: now });
      await db.blocks
        .where("noteId")
        .equals(id)
        .modify({ deletedAt: now, updatedAt: now });
    });
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
