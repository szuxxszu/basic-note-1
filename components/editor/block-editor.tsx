"use client";

import { useCallback, useRef, useState, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useBlocks, type DecryptedBlock } from "@/hooks/use-blocks";
import { BlockRenderer } from "./block-renderer";
import { SlashCommandMenu } from "./slash-command-menu";
import { MAX_INDENT } from "@/lib/constants";
import type { BlockType, BlockMeta } from "@/lib/types";

interface BlockEditorProps {
  noteId: string;
}

function SortableBlock({
  block,
  index,
  focusedIndex,
  numberedCounter,
  onContentChange,
  onMetaChange,
  onKeyDown,
  onFocus,
  registerRef,
}: {
  block: DecryptedBlock;
  index: number;
  focusedIndex: number;
  numberedCounter: number;
  onContentChange: (blockId: string, content: string) => void;
  onMetaChange: (blockId: string, meta: BlockMeta) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>, index: number) => void;
  onFocus: (index: number) => void;
  registerRef: (index: number, el: HTMLElement | null) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative flex items-start gap-1"
    >
      <div
        className="flex shrink-0 items-center pt-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
      </div>
      <div className="flex-1 min-w-0">
        <BlockRenderer
          type={block.type}
          id={block.id}
          content={block.decryptedContent}
          indent={block.indent}
          meta={block.meta}
          number={numberedCounter}
          isFocused={focusedIndex === index}
          onContentChange={(content) => onContentChange(block.id, content)}
          onMetaChange={(meta) => onMetaChange(block.id, meta)}
          onKeyDown={(e) => onKeyDown(e, index)}
          onFocus={() => onFocus(index)}
          registerRef={(el) => registerRef(index, el)}
        />
      </div>
    </div>
  );
}

export function BlockEditor({ noteId }: BlockEditorProps) {
  const { blocks, createBlock, updateBlock, deleteBlock, reorderBlock } =
    useBlocks(noteId);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [slashMenu, setSlashMenu] = useState<{
    open: boolean;
    position: { top: number; left: number };
    blockIndex: number;
  }>({ open: false, position: { top: 0, left: 0 }, blockIndex: -1 });

  const blockRefs = useRef<Map<number, HTMLElement>>(new Map());
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Compute numbered counters
  const numberedCounters = useMemo(() => {
    const counters: number[] = [];
    let count = 0;
    for (const block of blocks) {
      if (block.type === "numbered") {
        count++;
        counters.push(count);
      } else {
        count = 0;
        counters.push(0);
      }
    }
    return counters;
  }, [blocks]);

  const registerRef = useCallback(
    (index: number, el: HTMLElement | null) => {
      if (el) {
        blockRefs.current.set(index, el);
      } else {
        blockRefs.current.delete(index);
      }
    },
    []
  );

  const focusBlock = useCallback((index: number) => {
    setFocusedIndex(index);
    // Small delay to let React render
    requestAnimationFrame(() => {
      const el = blockRefs.current.get(index);
      if (el) el.focus();
    });
  }, []);

  const handleContentChange = useCallback(
    (blockId: string, content: string) => {
      // Detect "/" typed at the start → open slash menu
      const blockIndex = blocks.findIndex((b) => b.id === blockId);
      if (content === "/") {
        const el = blockRefs.current.get(blockIndex);
        if (el) {
          const rect = el.getBoundingClientRect();
          setSlashMenu({
            open: true,
            position: { top: rect.bottom + 4, left: rect.left },
            blockIndex,
          });
        }
        return; // Don't save the "/" yet
      }

      // If slash menu is open and content no longer starts with "/", close it
      if (slashMenu.open && !content.startsWith("/")) {
        setSlashMenu({ open: false, position: { top: 0, left: 0 }, blockIndex: -1 });
      }

      // Debounced save
      const existing = saveTimers.current.get(blockId);
      if (existing) clearTimeout(existing);
      saveTimers.current.set(
        blockId,
        setTimeout(() => {
          updateBlock(blockId, { content });
          saveTimers.current.delete(blockId);
        }, 400)
      );
    },
    [updateBlock, blocks, slashMenu.open]
  );

  const handleMetaChange = useCallback(
    (blockId: string, meta: BlockMeta) => {
      updateBlock(blockId, { meta });
    },
    [updateBlock]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>, index: number) => {
      const block = blocks[index];
      if (!block) return;

      // Get actual DOM content (not debounced state)
      const el = blockRefs.current.get(index);
      const liveContent = el?.textContent?.trim() ?? block.decryptedContent;

      // Enter — create new block below
      if (e.key === "Enter" && !e.shiftKey) {
        if (block.type === "code") return; // Allow newlines in code blocks
        e.preventDefault();

        // If current block is an empty list-type, convert to text
        if (
          liveContent === "" &&
          ["bullet", "numbered", "todo"].includes(block.type)
        ) {
          updateBlock(block.id, { type: "text", indent: 0 });
          return;
        }

        // Flush current content before creating new block
        if (liveContent !== block.decryptedContent) {
          const existing = saveTimers.current.get(block.id);
          if (existing) clearTimeout(existing);
          updateBlock(block.id, { content: liveContent });
        }

        const newType: BlockType =
          ["bullet", "numbered", "todo"].includes(block.type)
            ? block.type
            : "text";
        const newMeta: BlockMeta =
          block.type === "todo" ? { checked: false } : {};

        createBlock(block.id, newType, "", newMeta).then(() => {
          focusBlock(index + 1);
        });
        return;
      }

      // Backspace on empty block — delete or convert
      if (e.key === "Backspace" && liveContent === "") {
        if (block.type !== "text") {
          e.preventDefault();
          updateBlock(block.id, { type: "text", indent: 0 });
          return;
        }
        if (blocks.length > 1) {
          e.preventDefault();
          deleteBlock(block.id);
          focusBlock(Math.max(0, index - 1));
          return;
        }
      }

      // Tab — indent
      if (e.key === "Tab" && !e.shiftKey && block.type !== "code") {
        e.preventDefault();
        if (block.indent < MAX_INDENT) {
          updateBlock(block.id, { indent: block.indent + 1 });
        }
        return;
      }

      // Shift+Tab — outdent
      if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        if (block.indent > 0) {
          updateBlock(block.id, { indent: block.indent - 1 });
        }
        return;
      }

      // Arrow Up — focus previous
      if (e.key === "ArrowUp" && index > 0) {
        const sel = window.getSelection();
        const el = e.target as HTMLElement;
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          // Only move if cursor is at the top of the block
          if (rect.top <= elRect.top + 2) {
            e.preventDefault();
            focusBlock(index - 1);
          }
        }
        return;
      }

      // Arrow Down — focus next
      if (e.key === "ArrowDown" && index < blocks.length - 1) {
        const sel = window.getSelection();
        const el = e.target as HTMLElement;
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          if (rect.bottom >= elRect.bottom - 2) {
            e.preventDefault();
            focusBlock(index + 1);
          }
        }
        return;
      }
    },
    [blocks, createBlock, updateBlock, deleteBlock, focusBlock]
  );

  const handleSlashSelect = useCallback(
    (type: BlockType) => {
      const { blockIndex } = slashMenu;
      const block = blocks[blockIndex];
      if (block) {
        const meta: BlockMeta =
          type === "heading"
            ? { level: 1 }
            : type === "todo"
              ? { checked: false }
              : {};
        // Clear the "/" and convert block type
        updateBlock(block.id, { type, content: "", meta });
        // Also clear the contentEditable visually
        const el = blockRefs.current.get(blockIndex);
        if (el) el.textContent = "";
      }
      setSlashMenu({ open: false, position: { top: 0, left: 0 }, blockIndex: -1 });
      focusBlock(blockIndex);
    },
    [blocks, slashMenu, updateBlock, focusBlock]
  );

  const handleSlashClose = useCallback(() => {
    setSlashMenu({ open: false, position: { top: 0, left: 0 }, blockIndex: -1 });
    // "/" stays in the block as normal text — user wanted to type "/"
    const { blockIndex } = slashMenu;
    if (blockIndex >= 0) {
      const block = blocks[blockIndex];
      if (block) {
        // Save the "/" as actual content
        updateBlock(block.id, { content: "/" });
      }
      focusBlock(blockIndex);
    }
  }, [slashMenu, blocks, updateBlock, focusBlock]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const beforeOrder = newIndex > 0 ? blocks[newIndex - 1 >= oldIndex ? newIndex : newIndex - 1].sortOrder : null;
      const afterOrder =
        newIndex < blocks.length - 1
          ? blocks[newIndex <= oldIndex ? newIndex : newIndex + 1]?.sortOrder ?? null
          : null;

      // More precise: place between the target's neighbors
      let before: string | null = null;
      let after: string | null = null;

      if (newIndex < oldIndex) {
        // Moving up
        before = newIndex > 0 ? blocks[newIndex - 1].sortOrder : null;
        after = blocks[newIndex].sortOrder;
      } else {
        // Moving down
        before = blocks[newIndex].sortOrder;
        after = newIndex + 1 < blocks.length ? blocks[newIndex + 1].sortOrder : null;
      }

      reorderBlock(active.id as string, before, after);
    },
    [blocks, reorderBlock]
  );

  if (blocks.length === 0) {
    return (
      <div className="text-muted-foreground text-sm py-4">
        로딩 중...
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blocks.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid gap-1">
            {blocks.map((block, index) => (
              <SortableBlock
                key={block.id}
                block={block}
                index={index}
                focusedIndex={focusedIndex}
                numberedCounter={numberedCounters[index]}
                onContentChange={handleContentChange}
                onMetaChange={handleMetaChange}
                onKeyDown={handleKeyDown}
                onFocus={setFocusedIndex}
                registerRef={registerRef}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <SlashCommandMenu
        open={slashMenu.open}
        position={slashMenu.position}
        onSelect={handleSlashSelect}
        onClose={handleSlashClose}
      />
    </>
  );
}
