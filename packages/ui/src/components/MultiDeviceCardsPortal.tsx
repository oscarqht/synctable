"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Laptop,
  Globe,
  ChevronDown,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  HardDrive,
  Sparkles,
} from "lucide-react";
import type { SynctableSyncResponse, BrowserTreeNode } from "../types";
import {
  countTabs,
  countWorkspaces,
  extractWorkspacesFromRoot,
  formatRelativeTime,
} from "../utils/treeUtils";
import { ZenSidebarView } from "./zen/ZenSidebarView";
import { DeviceCard } from "./DeviceCard";

export interface MultiDeviceCardsPortalProps {
  data: SynctableSyncResponse | null;
  loading?: boolean;
  onRefresh?: () => void;
  onOpenExternal?: (url: string) => void;
  onSaveToken?: (token: string) => Promise<void> | void;
  onSwitchToLocal?: () => void;
}

export function MultiDeviceCardsPortal({
  data,
  loading = false,
  onRefresh,
  onOpenExternal,
  onSaveToken,
  onSwitchToLocal,
}: MultiDeviceCardsPortalProps) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("all");
  const [selectedBrowser, setSelectedBrowser] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [tokenInput, setTokenInput] = useState<string>("");
  const [savingToken, setSavingToken] = useState<boolean>(false);

  // Compute valid devices with non-empty tabs
  const validDevices = useMemo(() => {
    if (!data?.devices) return [];
    return data.devices.filter((dev) => {
      const tabs = dev.tree.reduce((acc, node) => acc + countTabs(node), 0);
      return tabs > 0;
    });
  }, [data]);

  // Compute available browsers across all valid devices
  const availableBrowsers = useMemo(() => {
    const set = new Set<string>();
    validDevices.forEach((dev) => {
      dev.tree.forEach((node) => {
        if (node.browser_name && countTabs(node) > 0) {
          set.add(node.browser_name.toLowerCase());
        }
      });
    });
    return Array.from(set).sort();
  }, [validDevices]);

  // Filter visible devices based on device selection
  const visibleDevices = useMemo(() => {
    if (selectedDeviceId === "all") return validDevices;
    return validDevices.filter((d) => d.deviceId === selectedDeviceId);
  }, [validDevices, selectedDeviceId]);

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = tokenInput.trim();
    if (!token || !onSaveToken) return;

    setSavingToken(true);
    try {
      await onSaveToken(token);
    } finally {
      setSavingToken(false);
    }
  };

  // 1. Loading State (when no data loaded yet or actively loading without existing data)
  if (!data || (loading && !data)) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 my-6">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-600 dark:text-cyan-400" />
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Locating Synctable collection & downloading tree snapshots...
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Querying Raindrop.io REST API and parsing JSON files
          </p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated / Missing Token State (Desktop flow where onSaveToken is provided)
  if (data.authenticated === false && onSaveToken) {
    return (
      <div className="py-16 px-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 text-center max-w-lg mx-auto space-y-5 shadow-sm my-6">
        <div className="w-14 h-14 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400 mx-auto text-2xl">
          💧
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Raindrop.io API Token Required
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {data.error ||
              "Enter your Raindrop.io API Test Token below to connect and view browser workspaces from all your devices."}
          </p>
        </div>

        <form onSubmit={handleTokenSubmit} className="space-y-3 text-left pt-2 max-w-sm mx-auto">
          <div>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste Raindrop API test token here"
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-slate-800 dark:text-slate-200"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={savingToken || !tokenInput.trim()}
              className="flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 text-white dark:text-slate-900 font-medium text-xs shadow-sm transition-all"
            >
              {savingToken ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 dark:text-cyan-600" />
              )}
              <span>Connect API Token</span>
            </button>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
            Get your token from{" "}
            <a
              href="https://app.raindrop.io/settings/integrations"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (onOpenExternal) {
                  e.preventDefault();
                  onOpenExternal("https://app.raindrop.io/settings/integrations");
                }
              }}
              className="text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Raindrop.io Settings → Integrations
            </a>
          </p>
        </form>
      </div>
    );
  }

  // 3. Error State (or unauthenticated state when onSaveToken is not present)
  if ((data.authenticated === false && !onSaveToken) || (data.error && validDevices.length === 0 && !data.collection)) {
    return (
      <div className="py-16 px-6 bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900/60 text-center max-w-lg mx-auto space-y-5 shadow-sm my-6">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {data.authenticated === false ? "Authentication Required" : "Failed to Load Raindrop Snapshots"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {data.error || "Please log in again to access your Synctable workspaces."}
          </p>
        </div>
        {onRefresh && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium shadow-sm transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Try Again</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // 3. No Synctable Collection Found State
  if (!data?.collection) {
    return (
      <div className="py-16 px-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 text-center max-w-2xl mx-auto space-y-6 shadow-sm my-6">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            No &quot;Synctable&quot; Collection Found in Raindrop
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
            We could not find a collection named <strong>Synctable</strong> in your Raindrop
            account. Follow these quick steps to upload your first snapshot:
          </p>
        </div>

        {/* Instruction Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
              STEP 1
            </span>
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 pt-1">
              Open Current Device
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Switch to the Current Device tab.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
              STEP 2
            </span>
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 pt-1">
              Set Raindrop Token
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Paste your token in Settings dialog.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
              STEP 3
            </span>
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 pt-1">
              Click Sync Now
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Trigger a sync to upload snapshot.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          {onSwitchToLocal && (
            <button
              onClick={onSwitchToLocal}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium shadow-sm transition-all"
            >
              <span>💻 Go to Current Device</span>
            </button>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium shadow-sm transition-all active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Check Raindrop Again</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // 4. Collection Found But 0 Valid Items State
  if (validDevices.length === 0) {
    return (
      <div className="py-16 px-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 text-center max-w-lg mx-auto space-y-5 shadow-sm my-6">
        <div className="w-14 h-14 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400 mx-auto">
          <HardDrive className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Collection &quot;Synctable&quot; is Empty
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            The root collection was found, but no non-empty device snapshots have been uploaded yet.
            Trigger a sync from your SyncTable desktop daemon.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          {onSwitchToLocal && (
            <button
              onClick={onSwitchToLocal}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium shadow-sm transition-all"
            >
              <span>💻 Sync Current Device</span>
            </button>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium shadow-sm transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // 5. Main Multi-Device Portal View
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
            placeholder="Search tabs, URLs, or workspaces across all devices..."
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

        {/* Filter Dropdowns & Refresh */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Devices Dropdown */}
          <div className="relative flex-1 sm:flex-initial min-w-[150px]">
            <Laptop className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all appearance-none cursor-pointer truncate"
              title="Filter by Device"
            >
              <option value="all">All Devices ({validDevices.length})</option>
              {validDevices.map((device) => {
                const tabs = device.tree.reduce((acc, t) => acc + countTabs(t), 0);
                return (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.deviceName} ({tabs} tabs)
                  </option>
                );
              })}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

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

          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center space-x-1.5 py-2 px-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-xs transition-all active:scale-95"
              title="Refresh Cloud Snapshots"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Device Trees / Zen Sidebars View Container */}
      <div className="space-y-6">
        {visibleDevices.map((device) => (
          <DeviceCard
            key={device.deviceId}
            deviceName={device.deviceName}
            badge={device.fileName}
            lastUpdated={device.lastUpdated}
            lastUpdatedLabel="Last synced"
            trees={device.tree}
            selectedBrowser={selectedBrowser}
            searchQuery={searchQuery}
            onOpenExternal={onOpenExternal}
          />
        ))}
      </div>
    </div>
  );
}
