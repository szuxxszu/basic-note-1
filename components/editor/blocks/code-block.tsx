"use client";

import { useRef, useEffect, useCallback } from "react";
import type { BlockComponentProps } from "../block-types";

export function CodeBlock({
  content,
  indent,
  onContentChange,
  onKeyDown,
  onFocus,
  registerRef,
  isFocused,
}: BlockComponentProps) {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    registerRef(ref.current);
  }, [registerRef]);

  useEffect(() => {
    if (ref.current && ref.current.textContent !== content) {
      ref.current.textContent = content;
    }
  }, [content]);

  useEffect(() => {
    if (isFocused && ref.current && document.activeElement !== ref.current) {
      ref.current.focus();
    }
  }, [isFocused]);

  const handleInput = useCallback(() => {
    if (ref.current) {
      onContentChange(ref.current.textContent ?? "");
    }
  }, [onContentChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      // Allow Tab inside code blocks to insert spaces
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        document.execCommand("insertText", false, "  ");
        return;
      }
      onKeyDown(e);
    },
    [onKeyDown]
  );

  return (
    <div style={{ paddingLeft: `${indent * 1.5}rem` }}>
      <pre
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="outline-none min-h-[1.5em] p-4 rounded-lg bg-muted font-mono text-sm leading-relaxed text-foreground overflow-x-auto"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        data-placeholder="코드를 입력하세요"
      />
    </div>
  );
}
