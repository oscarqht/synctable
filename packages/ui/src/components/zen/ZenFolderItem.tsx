"use client";

import React, { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import type { BrowserTreeNode } from "../../types";
import { countTabs, getAllTabUrls } from "../../utils/treeUtils";
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
  isSingleColumn?: boolean;
  alwaysShowActions?: boolean;
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
  isSingleColumn = false,
  alwaysShowActions = false,
  onSelectTab,
  onOpenExternal,
}: ZenFolderItemProps) {
  const [isOpen, setIsOpen] = useState<boolean>(defaultExpanded);
  const [copied, setCopied] = useState<boolean>(false);
  const children = (folder.children || []).filter((c) => countTabs(c) > 0);

  React.useEffect(() => {
    setIsOpen(defaultExpanded);
  }, [defaultExpanded]);

  if (countTabs(folder) === 0 || children.length === 0) {
    return null;
  }

  const handleCopyFolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const urls = getAllTabUrls(folder);
    if (urls.length > 0) {
      navigator.clipboard.writeText(urls.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  const handleOpenFolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const urls = getAllTabUrls(folder);
    if (urls.length > 0) {
      if (onOpenExternal) {
        urls.forEach((url) => onOpenExternal(url));
      } else {
        urls.forEach((url) => {
          window.open(url, "_blank", "noopener,noreferrer");
        });
      }
    }
  };

  const folderColor =
    folder.theme_color ||
    (folder.theme_colors && folder.theme_colors.length > 0
      ? folder.theme_colors[0]
      : null);

  if (isCompact) {
    return (
      <div
        onClick={() => setIsOpen(!isOpen)}
        title={`Folder: ${folder.title || "Folder"} (${children.length} tabs)`}
        className={`w-10 h-10 rounded-2xl flex items-center justify-center cursor-pointer relative transition-all ${
          isDarkTheme ? "hover:bg-white/20 text-white" : "hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
        }`}
      >
        <ZenFolderIcon isOpen={isOpen} size={22} color={folderColor} />
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
        {/* Color Outline Folder Icon or Emoji */}
        {folder.icon ? (
          <span className="text-base shrink-0 leading-none">{folder.icon}</span>
        ) : (
          <ZenFolderIcon isOpen={isOpen} size={22} color={folderColor} />
        )}

        {/* Folder Title */}
        <span
          className={`text-sm font-bold truncate flex-1 leading-tight tracking-tight flex items-center gap-2 ${
            isDarkTheme ? "text-white" : "text-slate-900 dark:text-slate-100"
          }`}
        >
          <span>{folder.title || "Folder"}</span>
          {folderColor && (
            <span
              className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
              style={{ backgroundColor: folderColor }}
              title={`Color: ${folderColor}`}
            />
          )}
        </span>

        {/* Action Buttons */}
        <div
          className={`${
            isSingleColumn || alwaysShowActions
              ? "flex"
              : "flex md:hidden md:group-hover/folder:flex"
          } items-center gap-1 shrink-0 -my-1`}
        >
          <button
            onClick={handleCopyFolder}
            title={`Copy all ${countTabs(folder)} tab URLs in folder`}
            className={`w-5 h-5 flex items-center justify-center rounded-md transition-all ${
              isDarkTheme
                ? "text-white/70 hover:text-white hover:bg-white/20"
                : "text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={handleOpenFolder}
            title={`Open all ${countTabs(folder)} tabs in folder`}
            className={`w-5 h-5 flex items-center justify-center rounded-md transition-all ${
              isDarkTheme
                ? "text-white/70 hover:text-white hover:bg-white/20"
                : "text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
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
                  isSingleColumn={isSingleColumn}
                  alwaysShowActions={alwaysShowActions}
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
                  activeTabId={activeTabId}
                  isCompact={isCompact}
                  isDarkTheme={isDarkTheme}
                  isSingleColumn={isSingleColumn}
                  alwaysShowActions={alwaysShowActions}
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
                isSingleColumn={isSingleColumn}
                alwaysShowActions={alwaysShowActions}
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
