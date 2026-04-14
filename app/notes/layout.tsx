"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@minnjii/dx-kit/ui/sidebar";
import { TooltipProvider } from "@minnjii/dx-kit/ui/tooltip";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { Separator } from "@minnjii/dx-kit/ui/separator";
import { cn } from "@minnjii/dx-kit/lib/utils";
import { FileText, Calendar, FolderTree } from "lucide-react";

const VIEW_TABS = [
  { href: "/notes", label: "모든 노트", icon: FileText },
  { href: "/notes/calendar", label: "캘린더", icon: Calendar },
  { href: "/notes/categories", label: "카테고리", icon: FolderTree },
] as const;

export default function NotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isTabActive = (href: string) => {
    if (href === "/notes") return pathname === "/notes";
    return pathname.startsWith(href);
  };

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 px-6">
            <SidebarTrigger className="-ml-2" />
            <Separator orientation="vertical" className="mr-2 !h-4" />
            <nav className="flex items-center gap-1">
              {VIEW_TABS.map((tab) => {
                const active = isTabActive(tab.href);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-secondary text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </Link>
                );
              })}
            </nav>
          </header>
          <main className="flex-1 overflow-auto px-6 pb-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
