"use client";

import { use } from "react";
import { NoteList } from "@/components/notes/note-list";

export default function CategoryNotesPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = use(params);

  return (
    <NoteList
      categoryId={categoryId}
      title="카테고리 노트"
      description="이 카테고리의 노트를 확인하세요"
    />
  );
}
