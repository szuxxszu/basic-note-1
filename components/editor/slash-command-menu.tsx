"use client";

import { useEffect, useRef, useState } from "react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
  CommandGroup,
} from "@minnjii/dx-kit/ui/command";
import {
  Type,
  Heading,
  List,
  ListOrdered,
  CheckSquare,
  Minus,
  Quote,
  Code,
} from "lucide-react";
import type { BlockType } from "@/lib/types";

const ICON_MAP: Record<BlockType, React.ElementType> = {
  text: Type,
  heading: Heading,
  bullet: List,
  numbered: ListOrdered,
  todo: CheckSquare,
  divider: Minus,
  quote: Quote,
  code: Code,
};

const ITEMS: { type: BlockType; label: string; description: string }[] = [
  { type: "text", label: "텍스트", description: "일반 텍스트 블록" },
  { type: "heading", label: "제목", description: "큰 제목" },
  { type: "bullet", label: "불릿 리스트", description: "불릿 포인트 리스트" },
  { type: "numbered", label: "번호 리스트", description: "번호 매기기 리스트" },
  { type: "todo", label: "할 일", description: "체크박스 리스트" },
  { type: "divider", label: "구분선", description: "수평 구분선" },
  { type: "quote", label: "인용", description: "인용문 블록" },
  { type: "code", label: "코드", description: "코드 블록" },
];

interface SlashCommandMenuProps {
  open: boolean;
  position: { top: number; left: number };
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

export function SlashCommandMenu({
  open,
  position,
  onSelect,
  onClose,
}: SlashCommandMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-50"
      style={{ top: position.top, left: position.left }}
    >
      <Command className="w-64 shadow-lg shadow-black/20 rounded-xl bg-popover">
        <CommandInput
          placeholder="블록 타입 검색..."
          value={search}
          onValueChange={setSearch}
          autoFocus
        />
        <CommandList>
          <CommandEmpty>결과 없음</CommandEmpty>
          <CommandGroup>
            {ITEMS.map((item) => {
              const Icon = ICON_MAP[item.type];
              return (
                <CommandItem
                  key={item.type}
                  value={item.label}
                  onSelect={() => onSelect(item.type)}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.description}
                    </div>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
