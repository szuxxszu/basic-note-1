"use client";

import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">설정</h1>
      </div>

      {/* Phase 7에서 설정 페이지 구현 */}
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
          <Settings className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium">설정</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Phase 7에서 구현 예정
        </p>
      </div>
    </div>
  );
}
