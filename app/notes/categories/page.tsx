"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@minnjii/dx-kit/ui/button";
import { Badge } from "@minnjii/dx-kit/ui/badge";
import {
  AccordionBlock,
  AccordionBlockItem,
  AccordionBlockTrigger,
  AccordionBlockContent,
} from "@minnjii/dx-kit/ui/accordion-block";
import { Plus, FolderTree, FileText, Folder } from "lucide-react";
import { useCategories } from "@/hooks/use-categories";
import { useNotes } from "@/hooks/use-notes";
import { NoteListItem } from "@/components/notes/note-list-item";
import { CategoryDialog } from "@/components/dialogs/category-dialog";
import type { CategoryTreeNode } from "@/lib/types";
import type { DecryptedNote } from "@/hooks/use-notes";

function CategoryBranch({
  node,
  allNotes,
}: {
  node: CategoryTreeNode;
  allNotes: DecryptedNote[];
}) {
  const categoryNotes = allNotes.filter((n) => n.categoryId === node.id);

  return (
    <AccordionBlockItem value={node.id}>
      <AccordionBlockTrigger
        action={
          <Badge variant="secondary" className="text-xs">
            {categoryNotes.length}
          </Badge>
        }
      >
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>{node.name}</span>
        </div>
      </AccordionBlockTrigger>
      <AccordionBlockContent>
        {categoryNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">노트가 없습니다</p>
        ) : (
          <div className="grid gap-2">
            {categoryNotes.map((note) => (
              <NoteListItem key={note.id} note={note} />
            ))}
          </div>
        )}
        {node.children.length > 0 && (
          <div className="mt-3 ml-4">
            <AccordionBlock type="multiple">
              {node.children.map((child) => (
                <CategoryBranch
                  key={child.id}
                  node={child}
                  allNotes={allNotes}
                />
              ))}
            </AccordionBlock>
          </div>
        )}
      </AccordionBlockContent>
    </AccordionBlockItem>
  );
}

export default function CategoriesPage() {
  const { tree, createCategory } = useCategories();
  const { notes, createNote } = useNotes();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  const uncategorizedNotes = notes.filter((n) => !n.categoryId);

  const handleCreateNote = async () => {
    const noteId = await createNote(null);
    if (noteId) router.push(`/notes/${noteId}`);
  };

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">카테고리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            카테고리별로 노트를 관리하세요
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            카테고리 추가
          </Button>
          <Button onClick={handleCreateNote}>
            <Plus className="mr-2 h-4 w-4" />
            새 노트
          </Button>
        </div>
      </div>

      {tree.length === 0 && uncategorizedNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <FolderTree className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">카테고리가 없습니다</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            카테고리를 만들어 노트를 분류하세요
          </p>
        </div>
      ) : (
        <AccordionBlock type="multiple">
          {tree.map((node) => (
            <CategoryBranch key={node.id} node={node} allNotes={notes} />
          ))}

          {uncategorizedNotes.length > 0 && (
            <AccordionBlockItem value="__uncategorized">
              <AccordionBlockTrigger
                action={
                  <Badge variant="secondary" className="text-xs">
                    {uncategorizedNotes.length}
                  </Badge>
                }
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>미분류</span>
                </div>
              </AccordionBlockTrigger>
              <AccordionBlockContent>
                <div className="grid gap-2">
                  {uncategorizedNotes.map((note) => (
                    <NoteListItem key={note.id} note={note} />
                  ))}
                </div>
              </AccordionBlockContent>
            </AccordionBlockItem>
          )}
        </AccordionBlock>
      )}

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={async (name) => {
          await createCategory(name);
        }}
      />
    </div>
  );
}
