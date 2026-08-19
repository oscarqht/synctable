"use client";

import React, { useState, useMemo } from "react";
import {
  Plus,
  PanelLeftClose,
  PanelLeft,
  Search,
  X,
  ExternalLink,
  Copy,
  Check,
  Globe,
  Sparkles,
} from "lucide-react";
import type { BrowserTreeNode } from "@/lib/types";
import { ZenWorkspaceBar } from "./ZenWorkspaceBar";
import { ZenPinnedTabsSection } from "./ZenPinnedTabsSection";
import { ZenFolderItem } from "./ZenFolderItem";
import { ZenSplitViewItem } from "./ZenSplitViewItem";
import { ZenTabItem, getDomain, getFaviconUrl } from "./ZenTabItem";

interface ZenSidebarViewProps {
  rootNode: BrowserTreeNode;
  searchQuery?: string;
}

export function ZenSidebarView({
  rootNode,
  searchQuery: externalSearch = "",
}: ZenSidebarViewProps) {
  const [isCompact, setIsCompact] = useState(false);
  const [internalSearch, setInternalSearch] = useState("");
  const [copied, setCopied] = useState(false);

  const activeSearch = externalSearch || internalSearch;

  // Extract workspaces or fallback
  const workspaces = useMemo<BrowserTreeNode[]>(() => {
    const list: BrowserTreeNode[] = [];

    function findWorkspaces(node: BrowserTreeNode) {
      if (node.node_type === "workspace") {
        list.push(node);
      } else if (node.children) {
        for (const child of node.children) {
          findWorkspaces(child);
        }
      }
    }

    findWorkspaces(rootNode);

    if (list.length === 0) {
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
          children: rootNode.children || [],
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
      if (item.node_type === "pinned_tab") {
        pinned.push(item);
      } else {
        regular.push(item);
      }
    }

    return { pinnedTabs: pinned, regularItems: regular };
  }, [activeWorkspace]);

  // Selected tab (default to first regular tab or first pinned tab if available)
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);

  // Set initial selected tab if none
  React.useEffect(() => {
    if (!selectedTabId) {
      if (regularItems.length > 0) {
        const firstTab = regularItems.find((i) => i.node_type === "tab") || regularItems[0];
        setSelectedTabId(firstTab?.id || null);
      } else if (pinnedTabs.length > 0) {
        setSelectedTabId(pinnedTabs[0].id);
      }
    }
  }, [regularItems, pinnedTabs, selectedTabId]);

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

  const selectedTab = useMemo<BrowserTreeNode | null>(() => {
    if (!selectedTabId) return null;

    function findTabRecursive(node: BrowserTreeNode): BrowserTreeNode | null {
      if (node.id === selectedTabId) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findTabRecursive(child);
          if (found) return found;
        }
      }
      return null;
    }

    return findTabRecursive(rootNode);
  }, [rootNode, selectedTabId]);

  const handleSelectTab = (tab: BrowserTreeNode) => {
    setSelectedTabId(tab.id || null);
  };

  const handleCopySelectedUrl = () => {
    if (selectedTab?.url) {
      navigator.clipboard.writeText(selectedTab.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full items-start">
      {/* Zen Sidebar Column */}
      <div
        className={`flex flex-col bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-3 sm:p-4 shadow-sm transition-all duration-200 ${
          isCompact ? "w-20 items-center" : "w-full lg:w-[320px]"
        }`}
      >
        {/* Top Controls: Browser Info & Compact toggle */}
        <div className="flex items-center justify-between w-full pb-2 mb-2">
          {!isCompact ? (
            <div className="flex items-center gap-2 min-w-0 px-1">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize truncate">
                {rootNode.title || rootNode.browser_name || "Browser"}
              </span>
            </div>
          ) : null}

          <button
            onClick={() => setIsCompact(!isCompact)}
            title={isCompact ? "Expand Sidebar" : "Compact Sidebar"}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all mx-auto lg:mx-0"
          >
            {isCompact ? (
              <PanelLeft className="w-4 h-4 text-cyan-600" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Search Input (if expanded) */}
        {!isCompact && !externalSearch && (
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

        {/* 1. Pinned / Essentials Top Row (3 rounded squircle cards) */}
        <ZenPinnedTabsSection
          pinnedTabs={pinnedTabs}
          isCompact={isCompact}
          activeTabId={selectedTabId}
          onSelectTab={handleSelectTab}
        />

        {/* 2. Workspace Header ("Personal") */}
        <ZenWorkspaceBar
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSelectWorkspace={setActiveWorkspaceId}
          isCompact={isCompact}
        />

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
                    isCompact={isCompact}
                    activeTabId={selectedTabId}
                    onSelectTab={handleSelectTab}
                  />
                );
              }

              if (item.node_type === "split_view") {
                return (
                  <ZenSplitViewItem
                    key={item.id || `split_${idx}`}
                    node={item}
                    isCompact={isCompact}
                    onSelectTab={handleSelectTab}
                  />
                );
              }

              return (
                <ZenTabItem
                  key={item.id || `tab_${idx}`}
                  tab={item}
                  isPinned={item.node_type === "pinned_tab"}
                  isCompact={isCompact}
                  isActive={selectedTabId === item.id}
                  onSelect={handleSelectTab}
                />
              );
            })
          )}
        </div>

        {/* 4. Divider & "+ New Tab" */}
        {!isCompact && (
          <div className="w-full pt-2 mt-2 border-t border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center gap-2.5 px-3 py-2 text-slate-500/80 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/40 dark:hover:bg-slate-800/40 rounded-2xl cursor-pointer transition-all">
              <Plus className="w-4 h-4" />
              <span className="text-sm font-semibold">New Tab</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Content / Active Tab Inspection Panel */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800/90 rounded-3xl p-6 shadow-sm min-h-[380px] justify-between">
        {selectedTab ? (
          <div className="space-y-6">
            {/* Active Tab Header */}
            <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                  {getFaviconUrl(selectedTab.url) ? (
                    <img
                      src={getFaviconUrl(selectedTab.url)}
                      alt=""
                      className="w-6 h-6 object-contain"
                    />
                  ) : (
                    <Globe className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                    {selectedTab.title || "Untitled Tab"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
                    {selectedTab.url || "about:blank"}
                  </p>
                </div>
              </div>

              {selectedTab.url && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopySelectedUrl}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all shadow-2xs"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copied ? "Copied" : "Copy URL"}</span>
                  </button>

                  <a
                    href={selectedTab.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-xs transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open URL</span>
                  </a>
                </div>
              )}
            </div>

            {/* Tab Metadata Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Type
                </span>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize">
                  {selectedTab.node_type.replace("_", " ")}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Domain
                </span>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {getDomain(selectedTab.url) || "Local"}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Workspace
                </span>
                <p className="text-xs font-bold text-purple-600 dark:text-purple-400 truncate">
                  {activeWorkspace?.title || "Personal"}
                </p>
              </div>
            </div>

            {/* Live Navigation Info Box */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-6 text-center space-y-2 mt-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400 mx-auto">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Zen Browser Sidebar Active
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Click any tab in the sidebar to elevate it into the active floating capsule card and inspect its details.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 py-12">
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Select a Tab in the Sidebar
            </h4>
            <p className="text-xs text-slate-500 max-w-sm">
              Click on any item in the Zen sidebar to activate and inspect it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
