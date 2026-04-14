import Dexie, { type EntityTable } from "dexie";
import type {
  Category,
  Note,
  Block,
  AppSettings,
  SyncMeta,
} from "./types";

const db = new Dexie("SecureNotes") as Dexie & {
  categories: EntityTable<Category, "id">;
  notes: EntityTable<Note, "id">;
  blocks: EntityTable<Block, "id">;
  settings: EntityTable<AppSettings, "id">;
  syncMeta: EntityTable<SyncMeta, "id">;
};

db.version(1).stores({
  categories: "id, parentId, sortOrder, deletedAt",
  notes: "id, categoryId, createdAt, updatedAt, deletedAt, pinned",
  blocks: "id, noteId, sortOrder, deletedAt, [noteId+sortOrder]",
  settings: "id",
  syncMeta: "id, [entityType+entityId], synced, timestamp",
});

export { db };
