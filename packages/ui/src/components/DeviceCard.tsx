"use client";

import React, { useMemo } from "react";
import { Laptop } from "lucide-react";
import type { BrowserTreeNode } from "../types";
import {
  countTabs,
  countWorkspaces,
  extractWorkspacesFromRoot,
  formatRelativeTime,
} from "../utils/treeUtils";
import { ZenSidebarView } from "./zen/ZenSidebarView";

export interface DeviceCardProps {
  deviceName: string;
  badge?: string;
  lastUpdated?: string | null;
  lastUpdatedLabel?: string;
  trees: BrowserTreeNode[];
  selectedBrowser?: string;
  searchQuery?: string;
  onOpenExternal?: (url: string) => void;
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
  onOpenExternal,
  emptyMessage,
}: DeviceCardProps) {
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

  const getBrowserLastUpdateTime = (nodes: BrowserTreeNode[]): string => {
    let latest = "";
    const walk = (node: BrowserTreeNode) => {
      const time = node.lastUpdateTime || node.snapshot_time || "";
      if (time > latest) latest = time;
      if (node.children) {
        node.children.forEach(walk);
      }
    };
    nodes.forEach(walk);
    return latest;
  };

  const browserGroups = useMemo(() => {
    const map = new Map<string, BrowserTreeNode[]>();
    for (const root of filteredRoots) {
      const bName = (root.browser_name || "browser").toLowerCase();
      if (!map.has(bName)) {
        map.set(bName, []);
      }
      map.get(bName)!.push(root);
    }
    const entries = Array.from(map.entries());
    return entries.sort(([nameA, treesA], [nameB, treesB]) => {
      const timeA = getBrowserLastUpdateTime(treesA);
      const timeB = getBrowserLastUpdateTime(treesB);
      if (timeA && timeB) {
        return timeB.localeCompare(timeA);
      }
      if (timeA) return -1;
      if (timeB) return 1;
      return nameA.localeCompare(nameB);
    });
  }, [filteredRoots]);

  const deviceBrowsers = useMemo(() => {
    const browserTimeMap = new Map<string, string>();
    for (const root of filteredRoots) {
      const bName = (root.browser_name || "").toLowerCase();
      if (bName) {
        const time = root.lastUpdateTime || root.snapshot_time || "";
        const existing = browserTimeMap.get(bName) || "";
        if (time > existing) {
          browserTimeMap.set(bName, time);
        }
      }
    }
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
              const browserLastUpdateTime = getBrowserLastUpdateTime(browserTrees);

              return (
                <div key={browserName} className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                        {browserName}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">
                        ({workspaces.length}{" "}
                        {workspaces.length === 1 ? "workspace" : "workspaces"})
                      </span>
                    </div>
                    {browserLastUpdateTime && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        Updated {formatRelativeTime(browserLastUpdateTime)}
                      </span>
                    )}
                  </div>
                  {/* Arrange each workspace as a separate card in the grid */}
                  <div
                    className={
                      workspaces.length === 1
                        ? "grid grid-cols-1 gap-4 items-start"
                        : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start"
                    }
                  >
                    {workspaces.map((wsItem) => (
                      <ZenSidebarView
                        key={wsItem.id}
                        workspaceItem={wsItem}
                        searchQuery={searchQuery}
                        isSingleColumn={workspaces.length === 1}
                        onOpenExternal={onOpenExternal}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
