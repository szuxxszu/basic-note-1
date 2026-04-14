"use client";

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@minnjii/dx-kit/ui/sidebar";
import { TooltipProvider } from "@minnjii/dx-kit/ui/tooltip";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { Separator } from "@minnjii/dx-kit/ui/separator";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 px-6">
            <SidebarTrigger className="-ml-2" />
            <Separator orientation="vertical" className="mr-2 !h-4" />
          </header>
          <main className="flex-1 overflow-auto px-6 pb-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
