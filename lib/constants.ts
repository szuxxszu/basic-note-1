import type { BlockType } from "./types";

export const BLOCK_TYPE_CONFIG: Record<
  BlockType,
  { label: string; icon: string; shortcut?: string }
> = {
  text: { label: "텍스트", icon: "Type", shortcut: "p" },
  heading: { label: "제목", icon: "Heading", shortcut: "h" },
  bullet: { label: "불릿 리스트", icon: "List", shortcut: "b" },
  numbered: { label: "번호 리스트", icon: "ListOrdered", shortcut: "n" },
  todo: { label: "할 일", icon: "CheckSquare", shortcut: "t" },
  divider: { label: "구분선", icon: "Minus", shortcut: "d" },
  quote: { label: "인용", icon: "Quote", shortcut: "q" },
  code: { label: "코드", icon: "Code", shortcut: "c" },
};

export const BLOCK_TYPES = Object.keys(BLOCK_TYPE_CONFIG) as BlockType[];

export const DEFAULT_LOCK_TIMEOUT_MINUTES = 5;

export const ENCRYPTION_ITERATIONS = 600_000;

export const VERIFIER_PLAINTEXT = "SecureNote-verified";

export const MAX_INDENT = 4;
