"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { useCrypto } from "@/components/providers/crypto-provider";
import { getOrderBetween } from "@/lib/fractional-index";
import type { Block, BlockType, BlockMeta } from "@/lib/types";
import { syncPushEntity } from "@/lib/sync/engine";
import { looksLikeCiphertext } from "@/lib/crypto";
import { isLockError } from "@/lib/decrypt-diagnostics";
import { tr } from "@/lib/i18n";

export interface DecryptedBlock extends Block {
  decryptedContent: string;
}

export function useBlocks(noteId: string) {
  const { encryptText, decryptText, isUnlocked } = useCrypto();
  // Cache decrypted plaintext by ciphertext. Without this, every Enter /
  // edit causes useLiveQuery to re-decrypt every block in the note, which
  // for even moderately sized notes blocks the UI for 50-200ms.
  const decryptCacheRef = useRef<Map<string, string>>(new Map());

  // Clear cache on lock so a different cryptoKey can't read stale plaintext.
  useEffect(() => {
    if (!isUnlocked) decryptCacheRef.current.clear();
  }, [isUnlocked]);

  // Optimistic local blocks — rendered immediately on createBlock before the
  // async encrypt + Dexie write has propagated. Entries get removed once the
  // real ciphertext block shows up in rawBlocks.
  const [optimisticBlocks, setOptimisticBlocks] = useState<DecryptedBlock[]>([]);

  // Reset optimistic state when switching notes so stale items don't leak.
  useEffect(() => {
    setOptimisticBlocks([]);
  }, [noteId]);

  const rawBlocks = useLiveQuery(
    () =>
      db.blocks
        .where("[noteId+sortOrder]")
        .between([noteId, ""], [noteId, "\uffff"])
        .toArray()
        .then((blocks) => blocks.filter((b) => !b.deletedAt)),
    [noteId],
    [] as Block[]
  );

  // Drop optimistic entries that have arrived in the real rawBlocks.
  useEffect(() => {
    if (!rawBlocks || rawBlocks.length === 0) return;
    const realIds = new Set(rawBlocks.map((b) => b.id));
    setOptimisticBlocks((prev) => {
      const kept = prev.filter((b) => !realIds.has(b.id));
      return kept.length === prev.length ? prev : kept;
    });
  }, [rawBlocks]);

  const decryptedReal = useLiveQuery(
    async () => {
      if (!isUnlocked || !rawBlocks || rawBlocks.length === 0) return [];
      const cache = decryptCacheRef.current;
      const decrypted = await Promise.all(
        rawBlocks.map(async (block) => {
          let decryptedContent = "";
          try {
            if (block.content) {
              const cached = cache.get(block.content);
              if (cached !== undefined) {
                decryptedContent = cached;
              } else {
                const text = await decryptText(block.content);
                decryptedContent = looksLikeCiphertext(text)
                  ? tr("lock.decryptFail")
                  : text;
                cache.set(block.content, decryptedContent);
              }
            }
          } catch (e) {
            // Transient lock (cryptoKey briefly null): leave content empty
            // instead of poisoning React state with a sticky fail label.
            decryptedContent = isLockError(e) ? "" : tr("lock.decryptFail");
          }
          return { ...block, decryptedContent } as DecryptedBlock;
        })
      );
      return decrypted;
    },
    [rawBlocks, isUnlocked],
    [] as DecryptedBlock[]
  );

  const blocks = useMemo<DecryptedBlock[]>(() => {
    const real = decryptedReal ?? [];
    if (optimisticBlocks.length === 0) return real;
    const realIds = new Set(real.map((b) => b.id));
    const pending = optimisticBlocks.filter((b) => !realIds.has(b.id));
    if (pending.length === 0) return real;
    return [...real, ...pending].sort((a, b) =>
      a.sortOrder.localeCompare(b.sortOrder)
    );
  }, [decryptedReal, optimisticBlocks]);

  const createBlock = useCallback(
    (
      afterBlockId: string | null,
      type: BlockType = "text",
      content: string = "",
      meta: BlockMeta = {}
    ): string | null => {
      if (!isUnlocked) return null;

      const allBlocks = rawBlocks ?? [];
      const afterIndex = afterBlockId
        ? allBlocks.findIndex((b) => b.id === afterBlockId)
        : -1;

      const before = afterIndex >= 0 ? allBlocks[afterIndex].sortOrder : null;
      const after =
        afterIndex >= 0 && afterIndex + 1 < allBlocks.length
          ? allBlocks[afterIndex + 1].sortOrder
          : null;

      const now = Date.now();
      const blockId = nanoid();
      const sortOrder = getOrderBetween(before, after);

      // Optimistic: show the block right away, with plaintext already known.
      const optimistic: DecryptedBlock = {
        id: blockId,
        noteId,
        type,
        content: "",
        decryptedContent: content,
        indent: 0,
        sortOrder,
        meta,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      setOptimisticBlocks((prev) => [...prev, optimistic]);

      // Persist in the background. Caller doesn't need to wait.
      (async () => {
        try {
          const encryptedContent = await encryptText(content);
          // Pre-populate decrypt cache so when rawBlocks updates, the block
          // doesn't go through a redundant decrypt round-trip.
          decryptCacheRef.current.set(encryptedContent, content);
          await db.blocks.add({
            id: blockId,
            noteId,
            type,
            content: encryptedContent,
            indent: 0,
            sortOrder,
            meta,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          });
          await db.notes.update(noteId, { updatedAt: now });
          const created = await db.blocks.get(blockId);
          if (created) syncPushEntity("block", created);
        } catch (err) {
          console.error("[useBlocks] createBlock persist failed:", err);
          setOptimisticBlocks((prev) => prev.filter((b) => b.id !== blockId));
        }
      })();

      return blockId;
    },
    [isUnlocked, encryptText, rawBlocks, noteId]
  );

  const updateBlock = useCallback(
    async (
      blockId: string,
      updates: {
        content?: string;
        type?: BlockType;
        indent?: number;
        meta?: BlockMeta;
      }
    ) => {
      if (!isUnlocked) return;

      const patch: Partial<Block> = { updatedAt: Date.now() };
      if (updates.content !== undefined) {
        patch.content = await encryptText(updates.content);
        // Keep the cache in sync so decryptedReal doesn't re-decrypt this.
        decryptCacheRef.current.set(patch.content, updates.content);
      }
      if (updates.type !== undefined) patch.type = updates.type;
      if (updates.indent !== undefined) patch.indent = updates.indent;
      if (updates.meta !== undefined) patch.meta = updates.meta;

      await db.blocks.update(blockId, patch);
      await db.notes.update(noteId, { updatedAt: Date.now() });

      const updated = await db.blocks.get(blockId);
      if (updated) syncPushEntity("block", updated);
    },
    [isUnlocked, encryptText, noteId]
  );

  const deleteBlock = useCallback(
    async (blockId: string) => {
      // If this was still in optimistic state (created so fast it hadn't hit
      // the DB yet), drop it locally too.
      setOptimisticBlocks((prev) => prev.filter((b) => b.id !== blockId));
      const now = Date.now();
      await db.blocks.update(blockId, { deletedAt: now, updatedAt: now });
      await db.notes.update(noteId, { updatedAt: now });
      const deleted = await db.blocks.get(blockId);
      if (deleted) syncPushEntity("block", deleted);
    },
    [noteId]
  );

  const reorderBlock = useCallback(
    async (blockId: string, beforeOrder: string | null, afterOrder: string | null) => {
      const newOrder = getOrderBetween(beforeOrder, afterOrder);
      await db.blocks.update(blockId, {
        sortOrder: newOrder,
        updatedAt: Date.now(),
      });
      const updated = await db.blocks.get(blockId);
      if (updated) syncPushEntity("block", updated);
    },
    []
  );

  return {
    blocks,
    createBlock,
    updateBlock,
    deleteBlock,
    reorderBlock,
  };
}
