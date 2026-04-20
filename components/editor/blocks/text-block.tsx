"use client";

import { useRef, useEffect, useCallback } from "react";
import type { BlockComponentProps } from "../block-types";

export function TextBlock({
  content,
  indent,
  onContentChange,
  onKeyDown,
  onFocus,
  registerRef,
  isFocused,
}: BlockComponentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerRef(ref.current);
  }, [registerRef]);

  useEffect(() => {
    if (!ref.current) return;
    // Don't overwrite DOM while user is editing — that resets cursor to start
    if (document.activeElement === ref.current) return;
    if (ref.current.textContent !== content) {
      ref.current.textContent = content;
    }
  }, [content, isFocused]);

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

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className="outline-none min-h-[1.5em] leading-relaxed text-foreground"
      style={{ paddingLeft: `${indent * 1.5}rem` }}
      onInput={handleInput}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      data-placeholder="텍스트를 입력하세요..."
    />
  );
}
