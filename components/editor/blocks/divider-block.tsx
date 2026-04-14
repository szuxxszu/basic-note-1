"use client";

import { useRef, useEffect } from "react";
import { Separator } from "@minnjii/dx-kit/ui/separator";
import type { BlockComponentProps } from "../block-types";

export function DividerBlock({
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
    if (isFocused && ref.current) {
      ref.current.focus();
    }
  }, [isFocused]);

  return (
    <div
      ref={ref}
      tabIndex={0}
      className="py-2 outline-none focus:ring-1 focus:ring-primary/20 rounded"
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      <Separator />
    </div>
  );
}
