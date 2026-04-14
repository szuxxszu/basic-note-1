"use client";

import { useRouter } from "next/navigation";
import { Button } from "@minnjii/dx-kit/ui/button";
import { Plus, FileText } from "lucide-react";
import { useNotes } from "@/hooks/use-notes";
import { NoteListItem } from "./note-list-item";

interface NoteListProps {
  categoryId?: string | null;
  title?: string;
  description?: string;
}

export function NoteList({
  categoryId,
  title = "모든 노트",
  description = "모든 노트를 한눈에 확인하세요",
}: NoteListProps) {
  const { notes, createNote } = useNotes(categoryId);
  const router = useRouter();

  const handleCreate = async () => {
    const noteId = await createNote(categoryId ?? null);
    if (noteId) router.push(`/notes/${noteId}`);
  };

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          새 노트
        </Button>
      </div>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">노트가 없습니다</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            새 노트를 만들어 시작하세요
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {notes.map((note) => (
            <NoteListItem key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}
