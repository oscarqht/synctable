import React, { useState, useMemo } from "react";
import {
  Search,
  RefreshCw,
  Clock,
  Compass,
  X,
  Layers,
  Globe,
} from "lucide-react";
import type { BrowserTreeNode, SyncStats } from "@synctable/ui";
import { TreeNodeItem, formatRelativeTime, countTabs } from "@synctable/ui";

export interface LocalTabProps {
  stats: SyncStats | null;
  trees: BrowserTreeNode[];
  syncing: boolean;
  onSync: () => void;
  onOpenExternal?: (url: string) => void;
}

const ALL_BROWSER_KEYS = ["chrome", "firefox", "arc", "vivaldi", "zen", "dia"];

export function LocalTab({
  stats,
  trees,
  syncing,
  onSync,
  onOpenExternal,
}: LocalTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrowser, setSelectedBrowser] = useState<string>("");

  const filteredTrees = useMemo(() => {
    return trees.filter((tree) => {
      if (selectedBrowser && tree.browser_name?.toLowerCase() !== selectedBrowser.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [trees, selectedBrowser]);

  const totalTabsCount = useMemo(() => {
    return trees.reduce((acc, t) => acc + countTabs(t), 0);
  }, [trees]);

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Left Sidebar */}
      <aside className="w-64 border-r border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md flex flex-col justify-between shrink-0">
        <div className="p-4 space-y-4 overflow-y-auto zen-scrollbar">
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Connected Browsers
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Detected local browser profiles
            </p>
          </div>

          <div className="space-y-1.5">
            {ALL_BROWSER_KEYS.map((browserKey) => {
              const count = stats?.browserCounts?.[browserKey] ?? 0;
              const isDetected = count > 0;
              const isSelected = selectedBrowser === browserKey;

              return (
                <button
                  key={browserKey}
                  onClick={() =>
                    setSelectedBrowser(isSelected ? "" : browserKey)
                  }
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                      : isDetected
                      ? "bg-slate-100/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 hover:bg-slate-200/70"
                      : "bg-transparent text-slate-400 dark:text-slate-600 hover:bg-slate-100/50"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isDetected
                          ? "bg-emerald-500 shadow-xs shadow-emerald-500/50"
                          : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    />
                    <span className="capitalize">{browserKey}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                      isSelected
                        ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                        : isDetected
                        ? "bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300"
                        : "text-slate-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
              <Clock className="w-3 h-3" />
              <span>Last Snapshot</span>
            </div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {stats?.lastSyncTime
                ? formatRelativeTime(stats.lastSyncTime)
                : "Never"}
            </p>
          </div>

          <button
            onClick={onSync}
            disabled={syncing}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium text-xs shadow-xs transition-all active:scale-98"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`}
            />
            <span>{syncing ? "Syncing..." : "Sync Now"}</span>
          </button>
        </div>
      </aside>

      {/* Main Snapshot Tree Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Local Topbar */}
        <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xs flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tabs, folders, workspaces in current device..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Browser Filter Dropdown */}
          <div className="relative min-w-[140px]">
            <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedBrowser}
              onChange={(e) => setSelectedBrowser(e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all appearance-none cursor-pointer"
            >
              <option value="">All Browsers</option>
              {ALL_BROWSER_KEYS.map((b) => (
                <option key={b} value={b}>
                  {b.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tree Scroll View */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 zen-scrollbar">
          {filteredTrees.length === 0 ? (
            <div className="py-20 text-center max-w-sm mx-auto space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto text-xl">
                📂
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No Browser Snapshots Yet
                </h3>
                <p className="text-xs text-slate-500">
                  Click &quot;Sync Now&quot; on the sidebar to poll and parse your
                  local browser trees.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTrees.map((rootNode) => (
                <TreeNodeItem
                  key={rootNode.id || `${rootNode.browser_name}_${rootNode.profile_name}`}
                  node={rootNode}
                  searchQuery={searchQuery}
                  onOpenExternal={onOpenExternal}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
