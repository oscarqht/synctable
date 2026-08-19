"use client";

import React, { useState } from "react";
import type { BrowserTreeNode } from "@/lib/types";
import { ZenFolderIcon } from "./ZenFolderIcon";
import { ZenTabItem } from "./ZenTabItem";
import { ZenSplitViewItem } from "./ZenSplitViewItem";

interface ZenFolderItemProps {
  folder: BrowserTreeNode;
  depth?: number;
  isCompact?: boolean;
  activeTabId?: string | null;
  defaultExpanded?: boolean;
  onSelectTab?: (tab: BrowserTreeNode) => void;
}

export function ZenFolderItem({
  folder,
  depth = 0,
  isCompact = false,
  activeTabId,
  defaultExpanded = true,
  onSelectTab,
}: ZenFolderItemProps) {
  const [isOpen, setIsOpen] = useState<boolean>(defaultExpanded);
  const children = folder.children || [];

  React.useEffect(() => {
    setIsOpen(defaultExpanded);
  }, [defaultExpanded]);

  if (isCompact) {
    return (
      <div
        onClick={() => setIsOpen(!isOpen)}
        title={`Folder: ${folder.title || "Folder"} (${children.length} tabs)`}
        className="w-10 h-10 rounded-2xl flex items-center justify-center cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-800/60 relative transition-all"
      >
        <ZenFolderIcon isOpen={isOpen} size={22} />
      </div>
    );
  }

  return (
    <div className="flex flex-col select-none my-0.5 group/folder">
      {/* Folder Row */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-all duration-150 active:scale-[0.99]"
      >
        {/* Blue Outline Folder Icon */}
        <ZenFolderIcon isOpen={isOpen} size={22} />

        {/* Folder Title */}
        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate flex-1 leading-tight tracking-tight">
          {folder.title || "Folder"}
        </span>
      </div>

      {/* Nested Children Indented */}
      {isOpen && children.length > 0 && (
        <div className="flex flex-col space-y-0.5 pl-6 my-0.5 transition-all">
          {children.map((child, idx) => {
            if (child.node_type === "folder") {
              return (
                <ZenFolderItem
                  key={child.id || `folder_${idx}`}
                  folder={child}
                  depth={depth + 1}
                  isCompact={isCompact}
                  activeTabId={activeTabId}
                  defaultExpanded={defaultExpanded}
                  onSelectTab={onSelectTab}
                />
              );
            }
            if (child.node_type === "split_view") {
              return (
                <ZenSplitViewItem
                  key={child.id || `split_${idx}`}
                  node={child}
                  isCompact={isCompact}
                  onSelectTab={onSelectTab}
                />
              );
            }
            return (
              <ZenTabItem
                key={child.id || `tab_${idx}`}
                tab={child}
                isPinned={child.node_type === "pinned_tab"}
                isCompact={isCompact}
                isActive={activeTabId === child.id}
                onSelect={onSelectTab}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
