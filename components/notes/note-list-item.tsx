"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@minnjii/dx-kit/ui/card";
import { Badge } from "@minnjii/dx-kit/ui/badge";
import { Pin } from "lucide-react";
import type { DecryptedNote } from "@/hooks/use-notes";

interface NoteListItemProps {
  note: DecryptedNote;
}

export function NoteListItem({ note }: NoteListItemProps) {
  const timeAgo = formatDistanceToNow(note.updatedAt, {
    addSuffix: true,
    locale: ko,
  });

  return (
    <Link href={`/notes/${note.id}`}>
      <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
        <CardHeader>
          <div className="flex items-center gap-2">
            {note.pinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
            <CardTitle className="text-base truncate">
              {note.decryptedTitle || "제목 없음"}
            </CardTitle>
          </div>
          <CardDescription className="line-clamp-1">
            {note.preview || "내용 없음"}
          </CardDescription>
          <CardAction>
            <Badge variant="secondary" className="text-xs shrink-0">
              {timeAgo}
            </Badge>
          </CardAction>
        </CardHeader>
      </Card>
    </Link>
  );
}
