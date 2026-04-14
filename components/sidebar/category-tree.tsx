"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
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
import { Folder, ChevronRight, Trash2 } from "lucide-react";
import { useCategories } from "@/hooks/use-categories";
import type { CategoryTreeNode } from "@/lib/types";

function CategoryNode({ node, depth = 0 }: { node: CategoryTreeNode; depth?: number }) {
  const pathname = usePathname();
  const { deleteCategory } = useCategories();
  const isActive = pathname === `/notes/categories/${node.id}`;
  const hasChildren = node.children.length > 0;

  if (hasChildren) {
    return (
      <Collapsible asChild>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={node.name}>
              <ChevronRight className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              <span>{node.name}</span>
            </SidebarMenuButton>
          </CollapsibleTrigger>
          {node.noteCount > 0 && (
            <SidebarMenuBadge>{node.noteCount}</SidebarMenuBadge>
          )}
          <SidebarMenuAction
            showOnHover
            onClick={() => deleteCategory(node.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </SidebarMenuAction>
          <CollapsibleContent>
            <SidebarMenuSub>
              {/* Link to this category's notes */}
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild isActive={isActive}>
                  <Link href={`/notes/categories/${node.id}`}>
                    모든 노트
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
                      {child.noteCount > 0 && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {child.noteCount}
                        </span>
                      )}
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
      {node.noteCount > 0 && (
        <SidebarMenuBadge>{node.noteCount}</SidebarMenuBadge>
      )}
      <SidebarMenuAction
        showOnHover
        onClick={() => deleteCategory(node.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </SidebarMenuAction>
    </SidebarMenuItem>
  );
}

export function CategoryTree() {
  const { tree } = useCategories();

  if (tree.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton disabled tooltip="카테고리 없음">
            <Folder className="opacity-50" />
            <span className="text-muted-foreground text-sm">카테고리 없음</span>
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
