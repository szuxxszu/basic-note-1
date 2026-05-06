"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@minnjii/dx-kit/ui/button";
import {
  AccordionBlock,
  AccordionBlockItem,
  AccordionBlockTrigger,
  AccordionBlockContent,
} from "@minnjii/dx-kit/ui/accordion-block";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@minnjii/dx-kit/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@minnjii/dx-kit/ui/alert-dialog";
import { Plus, FolderTree, FileText, Folder, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLoadingIndicator } from "@/components/providers/global-loading";
import { useCategories } from "@/hooks/use-categories";
import { useNotes } from "@/hooks/use-notes";
import { useNotesCount } from "@/components/providers/notes-count-provider";
import { NoteCard } from "@/components/notes/note-card";
import { CategoryDialog } from "@/components/dialogs/category-dialog";
import { useLanguage } from "@/components/providers/language-provider";
import type { Category, CategoryTreeNode } from "@/lib/types";
import type { DecryptedNote } from "@/hooks/use-notes";

function CategoryBranch({
  node,
  allNotes,
  onEditCategory,
  onDeleteCategory,
  noNotesLabel,
}: {
  node: CategoryTreeNode;
  allNotes: DecryptedNote[];
  onEditCategory: (id: string, name: string) => void;
  onDeleteCategory: (id: string, name: string) => void;
  noNotesLabel: string;
}) {
  const { t } = useLanguage();
  const categoryNotes = allNotes.filter((n) => n.categoryId === node.id);
  // Use the layout-level count context so the badge doesn't flash "(0)" while
  // useNotes finishes its async decrypt. Falls back to the local filter if the
  // context value isn't ready yet (e.g. very first visit, sessionStorage miss).
  const hotCount = useNotesCount(node.id);
  const displayCount = hotCount ?? categoryNotes.length;

  return (
    <AccordionBlockItem value={node.id}>
      <AccordionBlockTrigger
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div role="button" tabIndex={0} className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer">
                <MoreVertical className="h-4 w-4" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[166px]">
              <DropdownMenuItem onClick={() => onEditCategory(node.id, node.name)}>
                <Pencil className="h-4 w-4" />
                {t("common.edit")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDeleteCategory(node.id, node.name)}
              >
                <Trash2 className="h-4 w-4" />
                {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        <div className="flex items-center gap-2">
          <Folder className="category-folder h-4 w-4 shrink-0" />
          <span>{node.name} <span className="text-[13px]">({displayCount})</span></span>
        </div>
      </AccordionBlockTrigger>
      <AccordionBlockContent>
        {categoryNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 pl-2">{noNotesLabel}</p>
        ) : (
          <div className="grid gap-2 pl-2">
            {categoryNotes.map((note) => (
              <NoteCard key={note.id} note={note} />
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
                  onEditCategory={onEditCategory}
                  onDeleteCategory={onDeleteCategory}
                  noNotesLabel={noNotesLabel}
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
  const { tree, categories, isLoading: categoriesLoading, createCategory, updateCategory, deleteCategoryWithNotes } = useCategories();
  const { notes, isLoading: notesLoading, createNote, moveToCategory } = useNotes();
  const isLoading = categoriesLoading || notesLoading;
  useLoadingIndicator("categories-page", isLoading);
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { t } = useLanguage();

  // Edit state
  const [editTarget, setEditTarget] = useState<{ id: string; name: string } | null>(null);

  // Delete state (2-step)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [showSecondConfirm, setShowSecondConfirm] = useState(false);
  // Step 1 → Step 2 전환 직후 Step 1이 unmount되며 호출되는 onOpenChange(false)에서
  // deleteTarget을 null로 초기화하지 않도록 동기적으로 표시하는 플래그. state closure
  // 로는 같은 render 안에서 showSecondConfirm이 아직 false라 race가 난다.
  const advancingToStep2Ref = useRef(false);

  const uncategorizedNotes = notes.filter((n) => !n.categoryId);
  const hotUncategorized = useNotesCount(null);
  const uncategorizedCount = hotUncategorized ?? uncategorizedNotes.length;

  const handleCreateNote = async () => {
    const noteId = await createNote(null);
    if (noteId) router.push(`/notes/${noteId}`);
  };

  const handleEditCategory = (id: string, name: string) => {
    setEditTarget({ id, name });
  };

  const handleDeleteCategory = (id: string, name: string) => {
    setDeleteTarget({ id, name });
  };

  const handleFirstConfirm = () => {
    if (!deleteTarget) return;
    advancingToStep2Ref.current = true;
    setShowSecondConfirm(true);
  };

  const handleFinalDelete = async () => {
    if (!deleteTarget) return;
    await deleteCategoryWithNotes(deleteTarget.id);
    toast.success(t("notes.deletedCategory"));
    setShowSecondConfirm(false);
    setDeleteTarget(null);
  };

  const deleteNoteCount = deleteTarget
    ? notes.filter((n) => n.categoryId === deleteTarget.id).length
    : 0;

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("categories.title")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("notes.category")}
          </Button>
          <Button onClick={handleCreateNote}>
            <Plus className="h-4 w-4" />
            {t("notes.note")}
          </Button>
        </div>
      </div>

      {isLoading ? null : tree.length === 0 && uncategorizedNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <FolderTree className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">{t("categories.empty")}</h3>
        </div>
      ) : (
        <AccordionBlock type="multiple">
          {tree.map((node) => (
            <CategoryBranch
              key={node.id}
              node={node}
              allNotes={notes}
              onEditCategory={handleEditCategory}
              onDeleteCategory={handleDeleteCategory}
              noNotesLabel={t("categories.noNotes")}
            />
          ))}

          {uncategorizedCount > 0 && (
            <AccordionBlockItem value="__uncategorized">
              <AccordionBlockTrigger>
                <div className="flex items-center gap-2">
                  <FileText className="uncategorized-icon h-4 w-4 shrink-0" />
                  <span>{t("categories.uncategorized")} <span className="text-[13px]">({uncategorizedCount})</span></span>
                </div>
              </AccordionBlockTrigger>
              <AccordionBlockContent>
                <div className="grid gap-2 pl-2">
                  {uncategorizedNotes.map((note) => (
                    <NoteCard key={note.id} note={note} />
                  ))}
                </div>
              </AccordionBlockContent>
            </AccordionBlockItem>
          )}
        </AccordionBlock>
      )}

      {/* Add Category Dialog */}
      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={async (name) => {
          await createCategory(name);
        }}
      />

      {/* Edit Category Dialog */}
      <CategoryDialog
        open={!!editTarget}
        onOpenChange={(open) => { if (!open) setEditTarget(null); }}
        onSubmit={async (name) => {
          if (!editTarget) return;
          await updateCategory(editTarget.id, { name });
          toast.success(t("categoryDialog.updated"));
          setEditTarget(null);
        }}
        defaultName={editTarget?.name ?? ""}
        title={t("categoryDialog.editTitle")}
        description={t("categoryDialog.editDesc")}
      />

      {/* Delete: Step 1 */}
      <AlertDialog
        open={!!deleteTarget && !showSecondConfirm}
        onOpenChange={(open) => {
          if (open) return;
          if (advancingToStep2Ref.current) {
            advancingToStep2Ref.current = false;
            return;
          }
          setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("notes.deleteCategory")}</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.name}&quot; {t("notes.deleteCategoryConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleFirstConfirm}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete: Step 2 */}
      <AlertDialog
        open={showSecondConfirm}
        onOpenChange={(open) => {
          if (!open) {
            setShowSecondConfirm(false);
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("notes.deleteCategoryFinal")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("notes.deleteCategoryWarn")} ({deleteNoteCount})
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalDelete}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
