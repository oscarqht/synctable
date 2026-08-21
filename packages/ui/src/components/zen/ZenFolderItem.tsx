"use client";

import React, { useState } from "react";
import type { BrowserTreeNode } from "../../types";
import { countTabs } from "../../utils/treeUtils";
import { ZenFolderIcon } from "./ZenFolderIcon";
import { ZenTabItem } from "./ZenTabItem";
import { ZenSplitViewItem } from "./ZenSplitViewItem";

export interface ZenFolderItemProps {
  folder: BrowserTreeNode;
  depth?: number;
  isCompact?: boolean;
  activeTabId?: string | null;
  defaultExpanded?: boolean;
  isDarkTheme?: boolean;
  onSelectTab?: (tab: BrowserTreeNode) => void;
  onOpenExternal?: (url: string) => void;
}

export function ZenFolderItem({
  folder,
  depth = 0,
  isCompact = false,
  activeTabId,
  defaultExpanded = true,
  isDarkTheme = false,
  onSelectTab,
  onOpenExternal,
}: ZenFolderItemProps) {
  const [isOpen, setIsOpen] = useState<boolean>(defaultExpanded);
  const children = (folder.children || []).filter((c) => countTabs(c) > 0);

  React.useEffect(() => {
    setIsOpen(defaultExpanded);
  }, [defaultExpanded]);

  if (countTabs(folder) === 0 || children.length === 0) {
    return null;
  }

  if (isCompact) {
    return (
      <div
        onClick={() => setIsOpen(!isOpen)}
        title={`Folder: ${folder.title || "Folder"} (${children.length} tabs)`}
        className={`w-10 h-10 rounded-2xl flex items-center justify-center cursor-pointer relative transition-all ${
          isDarkTheme ? "hover:bg-white/20 text-white" : "hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
        }`}
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
        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl cursor-pointer transition-all duration-150 active:scale-[0.99] ${
          isDarkTheme
            ? "hover:bg-white/15 text-white"
            : "hover:bg-white/40 dark:hover:bg-white/10"
        }`}
      >
        {/* Blue Outline Folder Icon */}
        <ZenFolderIcon isOpen={isOpen} size={22} />

        {/* Folder Title */}
        <span
          className={`text-sm font-bold truncate flex-1 leading-tight tracking-tight ${
            isDarkTheme ? "text-white" : "text-slate-900 dark:text-slate-100"
          }`}
        >
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
                  isDarkTheme={isDarkTheme}
                  onSelectTab={onSelectTab}
                  onOpenExternal={onOpenExternal}
                />
              );
            }
            if (child.node_type === "split_view") {
              return (
                <ZenSplitViewItem
                  key={child.id || `split_${idx}`}
                  node={child}
                  isCompact={isCompact}
                  isDarkTheme={isDarkTheme}
                  onSelectTab={onSelectTab}
                  onOpenExternal={onOpenExternal}
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
                isDarkTheme={isDarkTheme}
                onSelect={onSelectTab}
                onOpenExternal={onOpenExternal}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
