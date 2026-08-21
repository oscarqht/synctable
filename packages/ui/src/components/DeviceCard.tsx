import React, { useState, useMemo } from "react";
import { Laptop, Sparkles, Globe } from "lucide-react";
import type {
  BrowserTreeNode,
  InstalledBrowser,
  RestoreSessionParams,
  RestoreSessionResult,
} from "../types";
import {
  countTabs,
  countWorkspaces,
  extractWorkspacesFromRoot,
  extractTreeStats,
  extractValidUrls,
  formatRelativeTime,
} from "../utils/treeUtils";
import { ZenSidebarView } from "./zen/ZenSidebarView";
import { RestoreSessionModal } from "./RestoreSessionModal";

export interface DeviceCardProps {
  deviceName: string;
  badge?: string;
  lastUpdated?: string | null;
  lastUpdatedLabel?: string;
  trees: BrowserTreeNode[];
  selectedBrowser?: string;
  searchQuery?: string;
  installedBrowsers?: InstalledBrowser[];
  onOpenExternal?: (url: string) => void;
  onOpenTabs?: (urls: string[], browserId?: string) => Promise<void> | void;
  onRestoreSession?: (params: RestoreSessionParams) => Promise<RestoreSessionResult>;
  emptyMessage?: string;
}

export function DeviceCard({
  deviceName,
  badge,
  lastUpdated,
  lastUpdatedLabel = "Last synced",
  trees,
  selectedBrowser = "all",
  searchQuery = "",
  installedBrowsers = [],
  onOpenExternal,
  onOpenTabs,
  onRestoreSession,
  emptyMessage,
}: DeviceCardProps) {
  const [restoreModalData, setRestoreModalData] = useState<{
    isOpen: boolean;
    browserName: string;
    trees: BrowserTreeNode[];
  } | null>(null);

  const filteredRoots = useMemo(() => {
    return trees.filter((node) => {
      if (countTabs(node) === 0) return false;
      if (selectedBrowser && selectedBrowser !== "all" && node.browser_name) {
        return node.browser_name.toLowerCase() === selectedBrowser.toLowerCase();
      }
      return true;
    });
  }, [trees, selectedBrowser]);

  const deviceTabsCount = useMemo(() => {
    return filteredRoots.reduce((acc, r) => acc + countTabs(r), 0);
  }, [filteredRoots]);

  const deviceWorkspacesCount = useMemo(() => {
    return filteredRoots.reduce((acc, r) => acc + countWorkspaces(r), 0);
  }, [filteredRoots]);

  const deviceBrowsers = useMemo(() => {
    return Array.from(
      new Set(
        filteredRoots
          .map((b) => b.browser_name?.toLowerCase())
          .filter((b): b is string => Boolean(b))
      )
    ).sort();
  }, [filteredRoots]);

  const browserGroups = useMemo(() => {
    const map = new Map<string, BrowserTreeNode[]>();
    for (const root of filteredRoots) {
      const bName = (root.browser_name || "browser").toLowerCase();
      if (!map.has(bName)) {
        map.set(bName, []);
      }
      map.get(bName)!.push(root);
    }
    return Array.from(map.entries());
  }, [filteredRoots]);

  const resolvedEmptyMessage =
    emptyMessage ||
    (badge
      ? `No tree snapshots match the current filters inside ${badge}.`
      : "No tree snapshots match the current filters.");

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Device Tree Header Banner */}
      <div className="bg-slate-50/90 dark:bg-slate-950/90 px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-300">
            <Laptop className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {deviceName}
              {badge && (
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.2 rounded font-mono">
                  {badge}
                </span>
              )}
            </h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {lastUpdatedLabel} {lastUpdated ? formatRelativeTime(lastUpdated) : "Never"} &middot;{" "}
              {deviceTabsCount} {deviceTabsCount === 1 ? "tab" : "tabs"} &middot;{" "}
              {deviceWorkspacesCount} {deviceWorkspacesCount === 1 ? "workspace" : "workspaces"}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {deviceBrowsers.map((b) => (
            <span
              key={b}
              className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-2xs"
            >
              {b}
            </span>
          ))}
        </div>
      </div>

      {/* Content Area: Zen Sidebar View */}
      <div className="p-4 space-y-4">
        {filteredRoots.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            {resolvedEmptyMessage}
          </div>
        ) : (
          <div className="space-y-6">
            {browserGroups.map(([browserName, browserTrees]) => {
              const workspaces = browserTrees.flatMap(extractWorkspacesFromRoot);
              if (workspaces.length === 0) return null;
              const groupStats = extractTreeStats(browserTrees);

              return (
                <div key={browserName} className="space-y-3">
                  {/* Browser Group Header with Quick Open & Native Restore Buttons */}
                  <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-bold tracking-wider text-slate-700 dark:text-slate-300">
                        {browserName}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">
                        ({workspaces.length}{" "}
                        {workspaces.length === 1 ? "workspace" : "workspaces"} &middot; {groupStats.tabs} tabs)
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* 1. Quick Open All URLs Button */}
                      {onOpenTabs && (
                        <button
                          onClick={() => {
                            const urls = extractValidUrls(browserTrees);
                            onOpenTabs(urls, "default");
                          }}
                          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer"
                          title={`Open all ${groupStats.tabs} tabs in default browser`}
                        >
                          <Globe className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                          <span>Open All Tabs ({groupStats.tabs})</span>
                        </button>
                      )}

                      {/* 2. Offline Session Injection & Restore Button */}
                      {onRestoreSession && (
                        <button
                          onClick={() => {
                            setRestoreModalData({
                              isOpen: true,
                              browserName,
                              trees: browserTrees,
                            });
                          }}
                          className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-[11px] font-bold shadow-xs hover:shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer"
                          title={`Restore full ${browserName} session (spaces, folders, split views, tabs) into local browser`}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                          <span>⚡ Restore to Local...</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Arrange each workspace as a separate card in the grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
                    {workspaces.map((wsItem) => (
                      <ZenSidebarView
                        key={wsItem.id}
                        workspaceItem={wsItem}
                        searchQuery={searchQuery}
                        onOpenExternal={onOpenExternal}
                        onOpenTabs={onOpenTabs}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Restore Session Modal */}
      {restoreModalData && (
        <RestoreSessionModal
          isOpen={restoreModalData.isOpen}
          onClose={() => setRestoreModalData(null)}
          sourceBrowserName={restoreModalData.browserName}
          sourceDeviceName={deviceName}
          trees={restoreModalData.trees}
          installedBrowsers={installedBrowsers}
          onRestore={onRestoreSession}
          onOpenTabs={onOpenTabs}
        />
      )}
    </div>
  );
}

