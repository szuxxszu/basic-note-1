"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useCrypto } from "@/components/providers/crypto-provider";
import { useNotes } from "@/hooks/use-notes";
import { BlockEditor } from "@/components/editor/block-editor";
import { NoteTitle } from "@/components/editor/note-title";
import { Button } from "@minnjii/dx-kit/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@minnjii/dx-kit/ui/dropdown-menu";
import { ArrowLeft, MoreHorizontal, Trash2, Pin, PinOff } from "lucide-react";

export default function NoteEditorPage({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = use(params);
  const router = useRouter();
  const { decryptText } = useCrypto();
  const { updateNoteTitle, deleteNote, togglePin } = useNotes();

  const [title, setTitle] = useState("");
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const note = useLiveQuery(() => db.notes.get(noteId), [noteId]);

  // Decrypt title
  useEffect(() => {
    if (!note) return;
    decryptText(note.title).then(setTitle).catch(() => setTitle("(복호화 실패)"));
  }, [note, decryptText]);

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle);
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      titleTimerRef.current = setTimeout(() => {
        updateNoteTitle(noteId, newTitle);
      }, 500);
    },
    [noteId, updateNoteTitle]
  );

  const handleDelete = useCallback(async () => {
    await deleteNote(noteId);
    router.push("/notes");
  }, [noteId, deleteNote, router]);

  if (!note) {
    return (
      <div className="text-muted-foreground text-sm py-8">로딩 중...</div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl grid gap-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/notes")}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          뒤로
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => togglePin(noteId)}>
              {note.pinned ? (
                <>
                  <PinOff className="mr-2 h-4 w-4" />
                  고정 해제
                </>
              ) : (
                <>
                  <Pin className="mr-2 h-4 w-4" />
                  고정
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Title */}
      <NoteTitle
        title={title}
        onTitleChange={handleTitleChange}
        onEnter={() => {
          // Focus first block
          const firstEditable = document.querySelector<HTMLElement>(
            "[contenteditable]"
          );
          // Skip title itself, focus the second contenteditable
          const all = document.querySelectorAll<HTMLElement>(
            "[contenteditable]"
          );
          if (all.length > 1) all[1].focus();
        }}
      />

      {/* Block Editor */}
      <BlockEditor noteId={noteId} />
    </div>
  );
}
