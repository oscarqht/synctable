"use client";

import React, { useState, useMemo } from "react";
import { Plus, Search, X } from "lucide-react";
import type { BrowserTreeNode } from "@/lib/types";
import { countTabs, pruneEmptyNodes } from "@/lib/treeUtils";
import { ZenWorkspaceBar } from "./ZenWorkspaceBar";
import { ZenPinnedTabsSection } from "./ZenPinnedTabsSection";
import { ZenFolderItem } from "./ZenFolderItem";
import { ZenSplitViewItem } from "./ZenSplitViewItem";
import { ZenTabItem } from "./ZenTabItem";

interface ZenSidebarViewProps {
  rootNode: BrowserTreeNode;
  searchQuery?: string;
}

export function ZenSidebarView({
  rootNode: rawRootNode,
  searchQuery: externalSearch = "",
}: ZenSidebarViewProps) {
  const rootNode = useMemo(() => pruneEmptyNodes(rawRootNode) || rawRootNode, [rawRootNode]);
  const [internalSearch, setInternalSearch] = useState("");
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const activeSearch = externalSearch || internalSearch;

  // Extract non-empty workspaces or fallback
  const workspaces = useMemo<BrowserTreeNode[]>(() => {
    const list: BrowserTreeNode[] = [];

    function findWorkspaces(node: BrowserTreeNode) {
      if (node.node_type === "workspace") {
        if (countTabs(node) > 0) {
          list.push(node);
        }
      } else if (node.children) {
        for (const child of node.children) {
          findWorkspaces(child);
        }
      }
    }

    findWorkspaces(rootNode);

    if (list.length === 0) {
      const validChildren = (rootNode.children || []).filter((c) => countTabs(c) > 0);
      if (validChildren.length === 0) return [];
      return [
        {
          id: `${rootNode.id}-default-space`,
          browser_name: rootNode.browser_name,
          os_type: rootNode.os_type,
          profile_name: rootNode.profile_name,
          node_type: "workspace",
          title: "Personal",
          url: null,
          parent_id: rootNode.id,
          sort_order: 0,
          snapshot_time: rootNode.snapshot_time,
          children: validChildren,
        },
      ];
    }

    return list;
  }, [rootNode]);

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(
    workspaces[0]?.id || ""
  );

  React.useEffect(() => {
    if (workspaces.length > 0 && !workspaces.some((w) => w.id === activeWorkspaceId)) {
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, activeWorkspaceId]);

  const activeWorkspace = useMemo(() => {
    return workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  }, [workspaces, activeWorkspaceId]);

  // Categorize items in active workspace: Pinned tabs, Folders, Split views, Regular tabs
  const { pinnedTabs, regularItems } = useMemo(() => {
    const pinned: BrowserTreeNode[] = [];
    const regular: BrowserTreeNode[] = [];

    const items = activeWorkspace?.children || [];

    for (const item of items) {
      if (countTabs(item) === 0) continue;
      if (item.node_type === "pinned_tab") {
        pinned.push(item);
      } else {
        regular.push(item);
      }
    }

    return { pinnedTabs: pinned, regularItems: regular };
  }, [activeWorkspace]);

  // Filter regular items by search
  const filteredItems = useMemo(() => {
    if (!activeSearch) return regularItems;
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

    return regularItems.filter(matchRecursive);
  }, [regularItems, activeSearch]);

  const handleSelectTab = (tab: BrowserTreeNode) => {
    setActiveTabId(tab.id || null);
  };

  if (countTabs(rootNode) === 0) {
    return null;
  }

  return (
    <div className="flex flex-col bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-3 sm:p-4 shadow-sm w-full transition-all">
      {/* Top Controls: Browser / Profile Info */}
      <div className="flex items-center justify-between w-full pb-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 px-1">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize truncate">
            {rootNode.title || rootNode.browser_name || "Browser"}
          </span>
        </div>
      </div>

      {/* Search Input */}
      {!externalSearch && (
        <div className="relative mb-3 w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={internalSearch}
            onChange={(e) => setInternalSearch(e.target.value)}
            placeholder="Search tabs..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-white/70 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-1.5 focus:ring-cyan-500 text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
          />
          {internalSearch && (
            <button
              onClick={() => setInternalSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* 1. Pinned / Essentials Top Row */}
      {pinnedTabs.length > 0 && (
        <ZenPinnedTabsSection
          pinnedTabs={pinnedTabs}
          activeTabId={activeTabId}
          onSelectTab={handleSelectTab}
        />
      )}

      {/* 2. Workspace Header ("Personal") */}
      {workspaces.length > 0 && (
        <ZenWorkspaceBar
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSelectWorkspace={setActiveWorkspaceId}
        />
      )}

      {/* 3. Tab and Folder List */}
      <div className="flex-1 w-full space-y-1 my-1">
        {filteredItems.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No tabs in this workspace
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            if (item.node_type === "folder") {
              return (
                <ZenFolderItem
                  key={item.id || `folder_${idx}`}
                  folder={item}
                  activeTabId={activeTabId}
                  onSelectTab={handleSelectTab}
                />
              );
            }

            if (item.node_type === "split_view") {
              return (
                <ZenSplitViewItem
                  key={item.id || `split_${idx}`}
                  node={item}
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
                onSelect={handleSelectTab}
              />
            );
          })
        )}
      </div>

      {/* 4. Divider & "+ New Tab" */}
      <div className="w-full pt-2 mt-2 border-t border-slate-200/70 dark:border-slate-800">
        <div className="flex items-center gap-2.5 px-3 py-2 text-slate-500/80 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/40 dark:hover:bg-slate-800/40 rounded-2xl cursor-pointer transition-all">
          <Plus className="w-4 h-4" />
          <span className="text-sm font-semibold">New Tab</span>
        </div>
      </div>
    </div>
  );
}
