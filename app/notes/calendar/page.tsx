"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "@minnjii/dx-kit/ui/calendar";
import { Card, CardContent } from "@minnjii/dx-kit/ui/card";
import { Button } from "@minnjii/dx-kit/ui/button";
import { Badge } from "@minnjii/dx-kit/ui/badge";
import { Plus, FileText } from "lucide-react";
import { ko } from "date-fns/locale";
import { format, startOfDay, isSameDay } from "date-fns";
import { useNotes } from "@/hooks/use-notes";
import { useCategories } from "@/hooks/use-categories";
import { NoteListItem } from "@/components/notes/note-list-item";

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { notes, createNote, moveToCategory } = useNotes();
  const { categories } = useCategories();
  const router = useRouter();

  // Dates that have notes (for dot indicators)
  const datesWithNotes = useMemo(() => {
    const seen = new Set<number>();
    const dates: Date[] = [];
    for (const note of notes) {
      const dayKey = startOfDay(note.createdAt).getTime();
      if (!seen.has(dayKey)) {
        seen.add(dayKey);
        dates.push(new Date(dayKey));
      }
    }
    return dates;
  }, [notes]);

  // Notes for the selected date
  const selectedNotes = useMemo(() => {
    return notes.filter((note) => isSameDay(note.createdAt, selectedDate));
  }, [notes, selectedDate]);

  const handleCreate = async () => {
    const noteId = await createNote(null);
    if (noteId) router.push(`/notes/${noteId}`);
  };

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">캘린더</h1>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          새 노트
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <Card className="h-fit">
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              locale={ko}
              modifiers={{ hasNotes: datesWithNotes }}
              modifiersClassNames={{
                hasNotes:
                  "relative after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary after:z-20 after:pointer-events-none data-[selected=true]:after:bg-black dark:data-[selected=true]:after:bg-black",
              }}
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 content-start">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-medium">
              {format(selectedDate, "M월 d일 (EEEE)", { locale: ko })}
            </h2>
            <Badge variant="secondary">{selectedNotes.length}개</Badge>
          </div>

          {selectedNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted mb-3">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                이 날짜에 수정된 노트가 없습니다
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {selectedNotes.map((note) => (
                <NoteListItem
                key={note.id}
                note={note}
                categories={categories}
                onMoveToCategory={moveToCategory}
              />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
