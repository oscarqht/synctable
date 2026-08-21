"use client";

import React, { useMemo } from "react";
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
    <div className="flex flex-col gap-8 w-full">
      {/* Dashboard Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 text-on-surface-variant flex-wrap">
          <span className="material-symbols-outlined bg-surface-container-high text-on-surface p-2 rounded-lg">
            laptop_mac
          </span>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface">
            {deviceName}
          </h2>
          {badge && (
            <span className="px-3 py-1 rounded bg-surface-container-high font-label-md text-label-md text-on-surface-variant font-mono">
              {badge}
            </span>
          )}
          {deviceBrowsers.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              {deviceBrowsers.map((b) => (
                <span
                  key={b}
                  className="px-3 py-1 rounded-full border border-outline-variant font-label-md text-label-md font-bold uppercase text-on-surface"
                >
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {lastUpdatedLabel} {lastUpdated ? formatRelativeTime(lastUpdated) : "Never"} · {deviceTabsCount} {deviceTabsCount === 1 ? "tab" : "tabs"} · {deviceWorkspacesCount} {deviceWorkspacesCount === 1 ? "workspace" : "workspaces"}
        </p>
      </div>

      {/* Content Area: Workspaces per Browser */}
      {filteredRoots.length === 0 ? (
        <div className="py-12 px-6 bg-surface-container-lowest border border-surface-variant rounded-lg text-center font-body-sm text-body-sm text-on-surface-variant">
          {resolvedEmptyMessage}
        </div>
      ) : (
        <div className="space-y-10">
          {browserGroups.map(([browserName, browserTrees]) => {
            const workspaces = browserTrees.flatMap(extractWorkspacesFromRoot);
            if (workspaces.length === 0) return null;
            const browserLastUpdateTime = getBrowserLastUpdateTime(browserTrees);

            return (
              <div key={browserName} className="space-y-6">
                {/* Section Title */}
                <div className="flex justify-between items-end border-b border-surface-container-high pb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-title-md text-title-md font-bold uppercase text-on-surface">
                      {browserName} Workspaces
                    </h3>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      ({workspaces.length} {workspaces.length === 1 ? "workspace" : "workspaces"})
                    </span>
                  </div>
                  {browserLastUpdateTime && (
                    <span className="font-body-sm text-body-sm text-outline">
                      Updated {formatRelativeTime(browserLastUpdateTime)}
                    </span>
                  )}
                </div>

                {/* Workspace Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[1500px]:grid-cols-5 2xl:grid-cols-5 gap-gutter items-start">
                  {workspaces.map((wsItem, wsIndex) => (
                    <ZenSidebarView
                      key={wsItem.id}
                      workspaceItem={wsItem}
                      cardIndex={wsIndex}
                      searchQuery={searchQuery}
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
  );
}
