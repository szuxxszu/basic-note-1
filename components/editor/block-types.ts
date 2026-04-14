import type { BlockType, BlockMeta } from "@/lib/types";

export interface BlockComponentProps {
  id: string;
  content: string;
  indent: number;
  meta: BlockMeta;
  isFocused: boolean;
  onContentChange: (content: string) => void;
  onMetaChange: (meta: BlockMeta) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  onFocus: () => void;
  registerRef: (el: HTMLElement | null) => void;
}
