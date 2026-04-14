"use client";

import { useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { useCrypto } from "@/components/providers/crypto-provider";
import { getOrderBetween } from "@/lib/fractional-index";
import type { Block, BlockType, BlockMeta } from "@/lib/types";
import { syncPushEntity } from "@/lib/sync/engine";

export interface DecryptedBlock extends Block {
  decryptedContent: string;
}

export function useBlocks(noteId: string) {
  const { encryptText, decryptText, isUnlocked } = useCrypto();

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

  const blocks = useLiveQuery(
    async () => {
      if (!isUnlocked || !rawBlocks || rawBlocks.length === 0) return [];
      const decrypted = await Promise.all(
        rawBlocks.map(async (block) => {
          let decryptedContent = "";
          try {
            if (block.content) {
              decryptedContent = await decryptText(block.content);
            }
          } catch {
            decryptedContent = "(복호화 실패)";
          }
          return { ...block, decryptedContent } as DecryptedBlock;
        })
      );
      return decrypted;
    },
    [rawBlocks, isUnlocked],
    [] as DecryptedBlock[]
  );

  const createBlock = useCallback(
    async (
      afterBlockId: string | null,
      type: BlockType = "text",
      content: string = "",
      meta: BlockMeta = {}
    ): Promise<string | null> => {
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
      const encryptedContent = await encryptText(content);

      await db.blocks.add({
        id: blockId,
        noteId,
        type,
        content: encryptedContent,
        indent: 0,
        sortOrder: getOrderBetween(before, after),
        meta,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      // Touch note updatedAt
      await db.notes.update(noteId, { updatedAt: now });

      const created = await db.blocks.get(blockId);
      if (created) syncPushEntity("block", created);

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
    blocks: blocks ?? [],
    createBlock,
    updateBlock,
    deleteBlock,
    reorderBlock,
  };
}
