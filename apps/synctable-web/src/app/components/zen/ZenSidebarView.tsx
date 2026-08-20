"use client";

import React, { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import type { BrowserTreeNode } from "@/lib/types";
import { countTabs, pruneEmptyNodes, extractWorkspacesFromRoot, type WorkspaceItem } from "@/lib/treeUtils";
import { ZenFolderItem } from "./ZenFolderItem";
import { ZenSplitViewItem } from "./ZenSplitViewItem";
import { ZenTabItem } from "./ZenTabItem";

export interface ZenSidebarViewProps {
  workspaceItem?: WorkspaceItem;
  rootNode?: BrowserTreeNode;
  searchQuery?: string;
}

function isDarkColor(hexColor?: string | null): boolean {
  if (!hexColor || !hexColor.startsWith("#")) return false;
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq < 140;
}

export function ZenSidebarView({
  workspaceItem,
  rootNode: rawRootNode,
  searchQuery: externalSearch = "",
}: ZenSidebarViewProps) {
  const [internalSearch, setInternalSearch] = useState("");
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const activeSearch = externalSearch || internalSearch;

  // Resolve current workspace item from props
  const currentWorkspaceItem = useMemo<WorkspaceItem | null>(() => {
    if (workspaceItem) return workspaceItem;
    if (rawRootNode) {
      const extracted = extractWorkspacesFromRoot(rawRootNode);
      if (extracted.length > 0) return extracted[0];
      const pruned = pruneEmptyNodes(rawRootNode) || rawRootNode;
      return {
        id: pruned.id || "workspace",
        browserName: (pruned.browser_name || "browser").toLowerCase(),
        browserTitle: pruned.title || pruned.browser_name || "Browser",
        profileName: pruned.profile_name || "Default",
        workspaceTitle: pruned.title || "Workspace",
        themeColor: pruned.theme_color,
        themeColors: pruned.theme_colors,
        icon: pruned.icon,
        node: pruned,
        tabCount: countTabs(pruned),
      };
    }
    return null;
  }, [workspaceItem, rawRootNode]);

  const workspaceNode = currentWorkspaceItem?.node;

  // Collect all items in this workspace (pinned tabs, folders, split views, regular tabs)
  const allItems = useMemo(() => {
    if (!workspaceNode?.children) return [];
    return workspaceNode.children.filter((item) => countTabs(item) > 0);
  }, [workspaceNode]);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    if (!activeSearch) return allItems;
    const q = activeSearch.toLowerCase();

    function matchRecursive(node: BrowserTreeNode): boolean {
      const match =
        (node.title && node.title.toLowerCase().includes(q)) ||
        (node.url && node.url.toLowerCase().includes(q));
      if (match) return true;
      if (node.children) {
        return node.children.some(matchRecursive);
      }
      return false;
    }

    return allItems.filter(matchRecursive);
  }, [allItems, activeSearch]);

  // Categorize filtered items into pinned tabs and regular items
  const { pinnedTabs, regularItems } = useMemo(() => {
    const pinned: BrowserTreeNode[] = [];
    const regular: BrowserTreeNode[] = [];

    for (const item of filteredItems) {
      if (item.node_type === "pinned_tab") {
        pinned.push(item);
      } else {
        regular.push(item);
      }
    }

    return { pinnedTabs: pinned, regularItems: regular };
  }, [filteredItems]);

  const isDark = Boolean(
    (currentWorkspaceItem?.themeColors && currentWorkspaceItem.themeColors.length > 0 && isDarkColor(currentWorkspaceItem.themeColors[0])) ||
    (currentWorkspaceItem?.themeColor && isDarkColor(currentWorkspaceItem.themeColor))
  );

  const handleSelectTab = (tab: BrowserTreeNode) => {
    setActiveTabId(tab.id || null);
  };

  const renderItem = (item: BrowserTreeNode, idx: number) => {
    if (item.node_type === "folder") {
      return (
        <ZenFolderItem
          key={item.id || `folder_${idx}`}
          folder={item}
          activeTabId={activeTabId}
          isDarkTheme={isDark}
          onSelectTab={handleSelectTab}
        />
      );
    }

    if (item.node_type === "split_view") {
      return (
        <ZenSplitViewItem
          key={item.id || `split_${idx}`}
          node={item}
          isDarkTheme={isDark}
          onSelectTab={handleSelectTab}
        />
      );
    }

    return (
      <ZenTabItem
        key={item.id || `tab_${idx}`}
        tab={item}
        isPinned={item.node_type === "pinned_tab"}
        isActive={activeTabId === item.id}
        isDarkTheme={isDark}
        onSelect={handleSelectTab}
      />
    );
  };

  if (!currentWorkspaceItem || currentWorkspaceItem.tabCount === 0) {
    return null;
  }

  const { browserTitle, profileName, workspaceTitle, tabCount } = currentWorkspaceItem;

  const hasThemeBg = Boolean(
    (currentWorkspaceItem.themeColors && currentWorkspaceItem.themeColors.length > 0) ||
    currentWorkspaceItem.themeColor
  );

  const themeBgStyle: React.CSSProperties | undefined = currentWorkspaceItem.themeColors && currentWorkspaceItem.themeColors.length > 1
    ? { background: `linear-gradient(135deg, ${currentWorkspaceItem.themeColors.join(", ")})` }
    : currentWorkspaceItem.themeColor
    ? { background: currentWorkspaceItem.themeColor }
    : undefined;

  return (
    <div
      style={themeBgStyle}
      className={`flex flex-col border rounded-3xl p-3 sm:p-4 shadow-sm w-full transition-all ${
        hasThemeBg
          ? isDark
            ? "border-white/15"
            : "border-black/10"
          : "bg-slate-100/90 dark:bg-slate-900/90 border-slate-200/80 dark:border-slate-800/80"
      }`}
    >
      {/* Top Controls: Browser & Profile Info + Tab Count */}
      <div className="flex items-center justify-between w-full pb-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 px-1">
          <span className={`text-xs font-bold capitalize truncate ${
            isDark ? "text-white" : "text-slate-800 dark:text-slate-200"
          }`}>
            {browserTitle}
          </span>
          {profileName && profileName !== "Default" && (
            <span className={`text-[10px] font-medium truncate max-w-[120px] px-1.5 py-0.5 rounded ${
              isDark ? "text-white/80 bg-white/15" : "text-slate-400 dark:text-slate-500"
            }`}>
              ({profileName})
            </span>
          )}
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
          isDark
            ? "text-white/90 bg-white/20 border border-white/20"
            : "text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800/60"
        }`}>
          {tabCount} {tabCount === 1 ? "tab" : "tabs"}
        </span>
      </div>

      {/* Search Input */}
      {!externalSearch && (
        <div className="relative mb-3 w-full">
          <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${
            isDark ? "text-white/60" : "text-slate-400"
          }`} />
          <input
            type="text"
            value={internalSearch}
            onChange={(e) => setInternalSearch(e.target.value)}
            placeholder="Search tabs..."
            className={`w-full pl-8 pr-7 py-1.5 text-xs rounded-xl focus:outline-hidden focus:ring-1.5 transition-all ${
              isDark
                ? "bg-white/15 border border-white/20 text-white placeholder:text-white/60 focus:bg-white/25 focus:ring-white/40"
                : "bg-white/70 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-cyan-500"
            }`}
          />
          {internalSearch && (
            <button
              onClick={() => setInternalSearch("")}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 ${
                isDark ? "text-white/60 hover:text-white" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* 1. Clean Workspace Label */}
      {workspaceTitle && (
        <div className="px-3.5 pt-1 pb-1 select-none">
          <span className={`text-xs sm:text-[13px] font-semibold tracking-tight flex items-center gap-1.5 ${
            isDark ? "text-white/90" : "text-slate-500/80 dark:text-slate-400/80"
          }`}>
            {currentWorkspaceItem.icon && <span className="text-sm">{currentWorkspaceItem.icon}</span>}
            <span>{workspaceTitle}</span>
          </span>
        </div>
      )}

      {/* 2. Tab and Folder List */}
      <div className="flex-1 w-full space-y-1 my-1">
        {filteredItems.length === 0 ? (
          <div className={`py-6 text-center text-xs ${
            isDark ? "text-white/70" : "text-slate-400"
          }`}>
            No tabs in this workspace
          </div>
        ) : (
          <>
            {/* Pinned tabs */}
            {pinnedTabs.map((item, idx) => renderItem(item, idx))}

            {/* Separator below pinned tabs */}
            {pinnedTabs.length > 0 && regularItems.length > 0 && (
              <div className={`my-2 border-b mx-1.5 ${
                isDark ? "border-white/20" : "border-slate-200/80 dark:border-slate-800/80"
              }`} />
            )}

            {/* Regular items */}
            {regularItems.map((item, idx) => renderItem(item, idx + pinnedTabs.length))}
          </>
        )}
      </div>
    </div>
  );
}
