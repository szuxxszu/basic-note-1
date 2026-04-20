"use client";

import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { enUS } from "date-fns/locale";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@minnjii/dx-kit/ui/card";
import { Badge } from "@minnjii/dx-kit/ui/badge";
import { Button } from "@minnjii/dx-kit/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@minnjii/dx-kit/ui/dropdown-menu";
import { Pin, FolderInput, Folder, Inbox, Check } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/providers/language-provider";
import type { DecryptedNote } from "@/hooks/use-notes";
import type { Category } from "@/lib/types";

interface NoteListItemProps {
  note: DecryptedNote;
  categories?: Category[];
  onMoveToCategory?: (noteId: string, categoryId: string | null) => void;
}

export function NoteListItem({
  note,
  categories,
  onMoveToCategory,
}: NoteListItemProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const dateLocale = language === "ko" ? ko : enUS;
  const timeAgo = formatDistanceToNow(note.updatedAt, {
    addSuffix: true,
    locale: dateLocale,
  });

  return (
    <Card
      className="transition-colors hover:bg-accent/50 cursor-pointer"
      onClick={() => router.push(`/notes/${note.id}`)}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          {note.pinned && (
            <Pin className="h-3.5 w-3.5 text-primary shrink-0" />
          )}
          <CardTitle className="text-base truncate">
            {note.decryptedTitle || t("notes.untitled")}
          </CardTitle>
        </div>
        <CardDescription className="line-clamp-1">
          {note.preview || t("notes.noContent")}
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-xs shrink-0">
              {timeAgo}
            </Badge>
            {onMoveToCategory && categories && categories.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-7 w-7 p-0 text-muted-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FolderInput className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-[166px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenuLabel>{t("editor.categoryMove")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      onMoveToCategory(note.id, null);
                      toast.success(t("editor.movedUncategorized"));
                    }}
                    disabled={!note.categoryId}
                  >
                    <Inbox className="h-4 w-4" />
                    {t("editor.uncategorized")}
                    {!note.categoryId && (
                      <Check className="ml-auto h-3.5 w-3.5" />
                    )}
                  </DropdownMenuItem>
                  {categories.map((cat) => (
                    <DropdownMenuItem
                      key={cat.id}
                      onClick={() => {
                        onMoveToCategory(note.id, cat.id);
                        toast.success(`"${cat.name}" ${t("editor.movedTo")}`);
                      }}
                      disabled={note.categoryId === cat.id}
                    >
                      <Folder className="h-4 w-4" />
                      {cat.name}
                      {note.categoryId === cat.id && (
                        <Check className="ml-auto h-3.5 w-3.5" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardAction>
      </CardHeader>
    </Card>
  );
}
