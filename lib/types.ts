// ─── Block Types ─────────────────────────────────────────────
export type BlockType =
  | "text"
  | "heading"
  | "bullet"
  | "numbered"
  | "todo"
  | "divider"
  | "quote"
  | "code";

export interface BlockMeta {
  level?: 1 | 2 | 3; // heading
  checked?: boolean; // todo
  language?: string; // code
}

// ─── Core Entities ───────────────────────────────────────────
export interface Category {
  id: string;
  parentId: string | null;
  name: string; // encrypted
  icon: string | null; // lucide icon name
  color: string | null; // token name e.g. "chart-1"
  sortOrder: string; // fractional index
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Note {
  id: string;
  categoryId: string | null;
  title: string; // encrypted
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Block {
  id: string;
  noteId: string;
  type: BlockType;
  content: string; // encrypted
  indent: number;
  sortOrder: string; // fractional index
  meta: BlockMeta;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

// ─── App Settings ────────────────────────────────────────────
export type ViewMode = "list" | "category" | "calendar";

export interface AppSettings {
  id: "settings";
  encryptionSalt: string; // base64
  encryptionVerifier: string; // encrypted known-plaintext
  lockTimeoutMinutes: number;
  defaultView: ViewMode;
  createdAt: number;
  updatedAt: number;
}

// ─── Sync ────────────────────────────────────────────────────
export type SyncOperation = "create" | "update" | "delete";
export type SyncEntityType = "note" | "block" | "category";

export interface SyncMeta {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  timestamp: number;
  synced: boolean;
}

// ─── UI Helpers ──────────────────────────────────────────────
export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
  noteCount: number;
}
