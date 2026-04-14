"use client";

import type { BlockComponentProps } from "./block-types";
import type { BlockType } from "@/lib/types";
import { TextBlock } from "./blocks/text-block";
import { HeadingBlock } from "./blocks/heading-block";
import { BulletBlock } from "./blocks/bullet-block";
import { NumberedBlock } from "./blocks/numbered-block";
import { TodoBlock } from "./blocks/todo-block";
import { DividerBlock } from "./blocks/divider-block";
import { QuoteBlock } from "./blocks/quote-block";
import { CodeBlock } from "./blocks/code-block";

interface BlockRendererProps extends BlockComponentProps {
  type: BlockType;
  number?: number;
}

export function BlockRenderer({ type, number, ...props }: BlockRendererProps) {
  switch (type) {
    case "heading":
      return <HeadingBlock {...props} />;
    case "bullet":
      return <BulletBlock {...props} />;
    case "numbered":
      return <NumberedBlock {...props} number={number ?? 1} />;
    case "todo":
      return <TodoBlock {...props} />;
    case "divider":
      return <DividerBlock {...props} />;
    case "quote":
      return <QuoteBlock {...props} />;
    case "code":
      return <CodeBlock {...props} />;
    default:
      return <TextBlock {...props} />;
  }
}
