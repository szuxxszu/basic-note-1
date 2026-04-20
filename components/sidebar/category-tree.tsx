"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@minnjii/dx-kit/ui/sidebar";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@minnjii/dx-kit/ui/collapsible";
import { Folder, ChevronRight } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";
import { useCategories } from "@/hooks/use-categories";
import type { CategoryTreeNode } from "@/lib/types";

function CategoryNode({ node, depth = 0 }: { node: CategoryTreeNode; depth?: number }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const isActive = pathname === `/notes/categories/${node.id}`;
  const hasChildren = node.children.length > 0;

  if (hasChildren) {
    return (
      <Collapsible asChild>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={node.name}>
              <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              <span>{node.name}</span>
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {/* Link to this category's notes */}
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild isActive={isActive}>
                  <Link href={`/notes/categories/${node.id}`}>
                    {t("categories.allNotes")}
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              {node.children.map((child) => (
                <SidebarMenuSubItem key={child.id}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={pathname === `/notes/categories/${child.id}`}
                  >
                    <Link href={`/notes/categories/${child.id}`}>
                      {child.name}
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={node.name}>
        <Link href={`/notes/categories/${node.id}`}>
          <Folder className="h-4 w-4" />
          <span>{node.name}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function CategoryTree() {
  const { tree } = useCategories();
  const { t } = useLanguage();

  if (tree.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton disabled tooltip={t("nav.noCategories")}>
            <Folder className="h-4 w-4 opacity-50" />
            <span className="text-muted-foreground text-sm">{t("nav.noCategories")}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      {tree.map((node) => (
        <CategoryNode key={node.id} node={node} />
      ))}
    </SidebarMenu>
  );
}
