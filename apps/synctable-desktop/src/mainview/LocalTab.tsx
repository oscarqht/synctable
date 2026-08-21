import React, { useState, useMemo } from "react";
import {
  Search,
  Globe,
  ChevronDown,
  X,
  RefreshCw,
  Laptop,
} from "lucide-react";
import type { BrowserTreeNode, SyncStats } from "@synctable/ui";
import {
  DeviceCard,
  countTabs,
  pruneEmptyNodes,
} from "@synctable/ui";

export interface LocalTabProps {
  stats: SyncStats | null;
  trees: BrowserTreeNode[];
  syncing: boolean;
  onSync: () => void;
  onOpenExternal?: (url: string) => void;
  deviceName?: string;
}

export function LocalTab({
  stats,
  trees,
  syncing,
  onSync,
  onOpenExternal,
  deviceName,
}: LocalTabProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedBrowser, setSelectedBrowser] = useState<string>("all");

  // Compute non-empty valid trees
  const validTrees = useMemo(() => {
    return trees
      .map(pruneEmptyNodes)
      .filter((node): node is BrowserTreeNode => node !== null && countTabs(node) > 0);
  }, [trees]);

  // Compute available browsers, sorted by lastUpdateTime DESC
  const availableBrowsers = useMemo(() => {
    const browserTimeMap = new Map<string, string>();
    validTrees.forEach((node) => {
      if (node.browser_name && countTabs(node) > 0) {
        const b = node.browser_name.toLowerCase();
        const time = node.lastUpdateTime || node.snapshot_time || "";
        const existing = browserTimeMap.get(b) || "";
        if (time > existing) {
          browserTimeMap.set(b, time);
        }
      }
    });
    return Array.from(browserTimeMap.keys()).sort((a, b) => {
      const timeA = browserTimeMap.get(a) || "";
      const timeB = browserTimeMap.get(b) || "";
      if (timeA && timeB) {
        return timeB.localeCompare(timeA);
      }
      if (timeA) return -1;
      if (timeB) return 1;
      return a.localeCompare(b);
    });
  }, [validTrees]);

  return (
    <div className="space-y-5">
      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tabs, URLs, or workspaces in current device..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdown & Sync */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Browsers Dropdown */}
          <div className="relative flex-1 sm:flex-initial min-w-[130px]">
            <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedBrowser}
              onChange={(e) => setSelectedBrowser(e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all appearance-none cursor-pointer truncate"
              title="Filter by Browser"
            >
              <option value="all">All Browsers</option>
              {availableBrowsers.map((b) => (
                <option key={b} value={b}>
                  {b.toUpperCase()}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Sync Button */}
          <button
            onClick={onSync}
            disabled={syncing}
            className="flex items-center space-x-1.5 py-2 px-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
            title="Poll and Parse Local Browser Trees"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Syncing..." : "Sync Now"}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {validTrees.length === 0 ? (
        <div className="py-16 px-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 text-center max-w-lg mx-auto space-y-5 shadow-xs my-6">
          <div className="w-14 h-14 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400 mx-auto text-2xl">
            💻
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              No Browser Snapshots Yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click &quot;Sync Now&quot; to poll and parse your local browser trees.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onSync}
              disabled={syncing}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-medium shadow-xs transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              <span>{syncing ? "Syncing..." : "Sync Now"}</span>
            </button>
          </div>
        </div>
      ) : (
        <DeviceCard
          deviceName={deviceName || "Current Device"}
          badge="Local"
          lastUpdated={stats?.lastSyncTime}
          lastUpdatedLabel="Last snapshot"
          trees={validTrees}
          selectedBrowser={selectedBrowser}
          searchQuery={searchQuery}
          onOpenExternal={onOpenExternal}
          emptyMessage="No tree snapshots match the current filters on this device."
        />
      )}
    </div>
  );
}
