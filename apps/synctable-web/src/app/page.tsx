"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  FolderTree,
  LogIn,
  LogOut,
  Sparkles,
  ShieldCheck,
  Globe,
  Layers,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  Laptop,
  Monitor,
  Filter,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  HardDrive,
  Clock,
  X,
} from "lucide-react";
import type { RaindropUserProfile } from "@/lib/raindrop";
import type {
  DeviceTreeData,
  SynctableSyncResponse,
  BrowserTreeNode,
} from "@/lib/types";
import { countTabs, countWorkspaces, pruneEmptyNodes, extractWorkspacesFromRoot } from "@/lib/treeUtils";
import { TreeNodeItem } from "./components/TreeNodeItem";
import { ZenSidebarView } from "./components/zen/ZenSidebarView";

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (isNaN(diffMs)) return "Unknown";
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 45) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay === 1) return "Yesterday";
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export default function Home() {
  const [user, setUser] = useState<RaindropUserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync data state
  const [syncData, setSyncData] = useState<SynctableSyncResponse | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedBrowser, setSelectedBrowser] = useState<string>("all");
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string>("all");
  const [treeExpandedState, setTreeExpandedState] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"zen_sidebar" | "tree">("zen_sidebar");

  // Load User Auth
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get("error");
    if (error) {
      setErrorMessage(error);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (err) {
        console.error("Failed to check auth status:", err);
      } finally {
        setAuthLoading(false);
      }
    }

    checkAuth();
  }, []);

  // Fetch Synctable Root Collection & Device Files
  const fetchSyncData = useCallback(async () => {
    if (!user) return;
    setSyncLoading(true);
    try {
      const res = await fetch("/api/sync/tree");
      if (res.ok) {
        const data = (await res.json()) as SynctableSyncResponse;
        setSyncData(data);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setErrorMessage(
          errorData.error || "Failed to load Synctable data from Raindrop"
        );
      }
    } catch (err: any) {
      console.error("Error fetching Synctable data:", err);
      setErrorMessage(err.message || "Failed to load Synctable data");
    } finally {
      setSyncLoading(false);
    }
  }, [user]);

  // Initial load and periodic auto-refresh every one minute (preserving filters & search query)
  useEffect(() => {
    if (!user) return;

    fetchSyncData();

    const AUTO_REFRESH_INTERVAL_MS = 60 * 1000;
    const intervalId = setInterval(() => {
      fetchSyncData();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [user, fetchSyncData]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setSyncData(null);
    } catch (err) {
      console.error("Failed to logout:", err);
    } finally {
      setLoggingOut(false);
    }
  };

  // Active devices with non-empty browser trees (ignoring empty devices and empty subtrees)
  const validDevices = useMemo(() => {
    if (!syncData?.devices) return [];
    return syncData.devices
      .map((dev) => {
        const prunedTree = dev.tree
          .map(pruneEmptyNodes)
          .filter(
            (node): node is BrowserTreeNode =>
              node !== null && countTabs(node) > 0
          );
        return {
          ...dev,
          tree: prunedTree,
        };
      })
      .filter((dev) => dev.tree.length > 0);
  }, [syncData]);

  // Collect all unique browsers across non-empty devices
  const availableBrowsers = useMemo(() => {
    if (!validDevices.length) return [];
    const set = new Set<string>();
    for (const dev of validDevices) {
      for (const node of dev.tree) {
        if (node.browser_name && countTabs(node) > 0) {
          set.add(node.browser_name.toLowerCase());
        }
      }
    }
    return Array.from(set).sort();
  }, [validDevices]);

  // Aggregate stats across non-empty devices
  const totalStats = useMemo(() => {
    if (!validDevices.length)
      return { totalTabs: 0, totalWorkspaces: 0, totalDevices: 0 };
    let tabs = 0;
    let workspaces = 0;
    for (const d of validDevices) {
      for (const tree of d.tree) {
        tabs += countTabs(tree);
        workspaces += countWorkspaces(tree);
      }
    }
    return {
      totalTabs: tabs,
      totalWorkspaces: workspaces,
      totalDevices: validDevices.length,
    };
  }, [validDevices]);

  // Active devices to render
  const visibleDevices = useMemo(() => {
    if (!validDevices.length) return [];
    if (selectedDeviceId === "all") return validDevices;
    return validDevices.filter((d) => d.deviceId === selectedDeviceId);
  }, [validDevices, selectedDeviceId]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 flex flex-col selection:bg-cyan-500/20 selection:text-cyan-900">
      {/* Navigation Header */}
      <header className="border-b border-slate-200/80 bg-white/85 backdrop-blur-xl sticky top-0 z-50 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-50 via-blue-50/40 to-white border border-sky-200/60 flex items-center justify-center shadow-xs text-lg select-none">
              🔄
            </div>
            <div>
              <div className="font-bold text-base tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent flex items-center gap-2">
                SyncTable{" "}
                <span className="text-[11px] font-semibold uppercase px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">
                  Web
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Cross-Browser Tab & Workspace Sync
              </p>
            </div>
          </div>

          {/* Header Right Actions / Profile */}
          <div className="flex items-center space-x-3">
            {authLoading ? (
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-600" />
                <span>Checking session...</span>
              </div>
            ) : user ? (
              /* User Profile in Header */
              <div className="flex items-center space-x-2.5">
                {/* Refresh Sync Data Button */}
                <button
                  onClick={fetchSyncData}
                  disabled={syncLoading}
                  title="Refresh Raindrop Synctable Data"
                  className="h-10 px-3.5 flex items-center space-x-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl transition-all shadow-xs hover:border-slate-300 active:scale-95"
                >
                  <RefreshCw
                    className={`w-4 h-4 text-cyan-600 ${
                      syncLoading ? "animate-spin" : ""
                    }`}
                  />
                  <span className="hidden sm:inline">Refresh</span>
                </button>

                <div className="h-10 flex items-center space-x-2.5 bg-slate-100/90 border border-slate-200/90 rounded-xl pl-2 pr-3.5 backdrop-blur shadow-xs">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-7 h-7 rounded-full object-cover border border-slate-200 shadow-xs"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center">
                      {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                    </div>
                  )}

                  <div className="flex flex-col text-left leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-800 max-w-[110px] sm:max-w-[150px] truncate">
                        {user.name}
                      </span>
                      {user.isPro && (
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          PRO
                        </span>
                      )}
                    </div>
                    {user.email && (
                      <span className="text-[10px] text-slate-500 max-w-[110px] sm:max-w-[150px] truncate">
                        {user.email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Logout button */}
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  title="Sign out of Raindrop"
                  className="h-10 px-3.5 flex items-center space-x-2 text-xs font-semibold bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl transition-all shadow-xs active:scale-95"
                >
                  {loggingOut ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              /* Login Button in Header */
              <a
                href="/api/auth/login"
                className="flex items-center space-x-2 text-xs font-medium bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white px-4 py-2 rounded-lg shadow-sm shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Connect Raindrop</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full flex flex-col">
        {/* Error notification banner */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 text-sm animate-fadeIn shadow-xs">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Notice:</span> {errorMessage}
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs text-rose-600 hover:text-rose-800 underline font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {authLoading ? (
          /* Loading Auth State */
          <div className="flex-1 flex flex-col items-center justify-center py-24 text-slate-500 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
            <p className="text-sm">Loading SyncTable...</p>
          </div>
        ) : !user ? (
          /* BEFORE LOGIN: Landing & Raindrop Connect Card */
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-4">
            <div className="w-full max-w-xl text-center space-y-8">
              <div className="flex flex-col items-center space-y-4">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs font-medium shadow-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Raindrop.io Cloud Sync Integration</span>
                </div>

                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-50 to-indigo-50 border border-cyan-200 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                    <FolderTree className="w-10 h-10 text-cyan-600" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-md">
                    💧
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">
                  Connect Your Raindrop Account
                </h1>
                <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto leading-relaxed">
                  Sign in with Raindrop.io to inspect, manage, and synchronize
                  your workspaces, browser trees, and split tabs seamlessly.
                </p>
              </div>

              <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-xl shadow-slate-200/60 space-y-4">
                <a
                  href="/api/auth/login"
                  className="w-full flex items-center justify-center space-x-2 py-3 px-6 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-medium text-sm shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Log in with Raindrop.io</span>
                </a>
                <p className="text-xs text-slate-500">
                  You will be securely redirected to Raindrop.io to authorize
                  SyncTable.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex flex-col space-y-1.5">
                  <div className="flex items-center space-x-2 text-cyan-600">
                    <Globe className="w-4 h-4" />
                    <span className="text-xs font-semibold text-slate-800">
                      Cross-Browser
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Sync tabs across Arc, Zen, Chrome, Firefox, Dia and more.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex flex-col space-y-1.5">
                  <div className="flex items-center space-x-2 text-indigo-600">
                    <Layers className="w-4 h-4" />
                    <span className="text-xs font-semibold text-slate-800">
                      Spaces & Splits
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Full hierarchy retention and workspace organisation.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex flex-col space-y-1.5">
                  <div className="flex items-center space-x-2 text-emerald-600">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-xs font-semibold text-slate-800">
                      Raindrop Cloud
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Decentralized, encrypted cloud sync via Raindrop API.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* AFTER LOGIN: Multi-Device Browser Tree Viewer */
          <div className="flex-1 flex flex-col space-y-6">

            {/* Syncing / Loading Overlay */}
            {syncLoading && !syncData ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-4 bg-white rounded-2xl border border-slate-200/80">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-slate-800">
                    Locating Synctable collection & downloading tree snapshots...
                  </p>
                  <p className="text-xs text-slate-500">
                    Querying Raindrop.io REST API and parsing JSON files
                  </p>
                </div>
              </div>
            ) : !syncData?.collection ? (
              /* No Synctable Collection Found State */
              <div className="py-16 px-6 bg-white rounded-2xl border border-slate-200/80 text-center max-w-2xl mx-auto space-y-6 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    No &quot;Synctable&quot; Collection Found in Raindrop
                  </h3>
                  <p className="text-sm text-slate-600 max-w-lg mx-auto">
                    We could not find a collection named <strong>Synctable</strong> in
                    your Raindrop account. Follow these quick steps to upload
                    your first snapshot:
                  </p>
                </div>

                {/* Instruction Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                      STEP 1
                    </span>
                    <h4 className="text-xs font-semibold text-slate-800 pt-1">
                      Open Desktop App
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Launch SyncTable on macOS/Windows/Linux.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                      STEP 2
                    </span>
                    <h4 className="text-xs font-semibold text-slate-800 pt-1">
                      Set Raindrop Token
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Go to Settings in Desktop app & paste your token.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                      STEP 3
                    </span>
                    <h4 className="text-xs font-semibold text-slate-800 pt-1">
                      Click Sync Now
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Click Sync Now and then refresh this page.
                    </p>
                  </div>
                </div>

                <button
                  onClick={fetchSyncData}
                  disabled={syncLoading}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium shadow-sm transition-all active:scale-95"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${syncLoading ? "animate-spin" : ""}`}
                  />
                  <span>Check Raindrop Again</span>
                </button>
              </div>
            ) : validDevices.length === 0 ? (
              /* Synctable Collection Found But 0 Items */
              <div className="py-16 px-6 bg-white rounded-2xl border border-slate-200/80 text-center max-w-lg mx-auto space-y-5 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600 mx-auto">
                  <HardDrive className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-slate-900">
                    Collection &quot;Synctable&quot; is Empty
                  </h3>
                  <p className="text-xs text-slate-500">
                    The root collection was found, but no non-empty device snapshots have
                    been uploaded yet. Trigger a sync from your SyncTable desktop
                    daemon.
                  </p>
                </div>
                <button
                  onClick={fetchSyncData}
                  disabled={syncLoading}
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium shadow-sm transition-all"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${syncLoading ? "animate-spin" : ""}`}
                  />
                  <span>Refresh</span>
                </button>
              </div>
            ) : (
              /* Devices and Browser Trees Available */
              <div className="space-y-5">
                {/* Search & Filter Toolbar */}
                <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
                  {/* Search Input */}
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search tabs, URLs, or profiles..."
                      className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-slate-800 placeholder:text-slate-400"
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

                  {/* Filter Dropdowns on the Right Side */}
                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
                    {/* Devices Dropdown */}
                    <div className="relative flex-1 sm:flex-initial min-w-[150px]">
                      <Laptop className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        value={selectedDeviceId}
                        onChange={(e) => setSelectedDeviceId(e.target.value)}
                        className="w-full pl-8 pr-8 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-100/80 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all appearance-none cursor-pointer truncate"
                        title="Filter by Device"
                      >
                        <option value="all">All Devices ({validDevices.length})</option>
                        {validDevices.map((device) => {
                          const deviceTabsCount = device.tree.reduce(
                            (acc, t) => acc + countTabs(t),
                            0
                          );
                          return (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.deviceName} ({deviceTabsCount} tabs)
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
                        className="w-full pl-8 pr-8 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-100/80 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all appearance-none cursor-pointer truncate"
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
                  </div>
                </div>

                {/* Device Trees / Zen Sidebars View Container */}
                <div className="space-y-6">
                  {visibleDevices.map((device) => {
                    const filteredRoots = device.tree.filter((node) => {
                      if (countTabs(node) === 0) return false;
                      if (selectedBrowser !== "all" && node.browser_name) {
                        return node.browser_name.toLowerCase() === selectedBrowser.toLowerCase();
                      }
                      return true;
                    });

                    const deviceTabsCount = filteredRoots.reduce((acc, r) => acc + countTabs(r), 0);
                    const deviceWorkspacesCount = filteredRoots.reduce(
                      (acc, r) => acc + countWorkspaces(r),
                      0
                    );
                    const deviceBrowsers = Array.from(
                      new Set(
                        filteredRoots
                          .map((b) => b.browser_name?.toLowerCase())
                          .filter((b): b is string => Boolean(b))
                      )
                    ).sort();

                    const browserGroups = (() => {
                      const map = new Map<string, BrowserTreeNode[]>();
                      for (const root of filteredRoots) {
                        const bName = (root.browser_name || "browser").toLowerCase();
                        if (!map.has(bName)) {
                          map.set(bName, []);
                        }
                        map.get(bName)!.push(root);
                      }
                      return Array.from(map.entries());
                    })();

                    return (
                      <div
                        key={device.deviceId}
                        className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden"
                      >
                        {/* Device Tree Header Banner */}
                        <div className="bg-slate-50/90 px-4 py-3 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                              <Laptop className="w-4 h-4" />
                            </div>
                            <div>
                              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                {device.deviceName}
                                <span className="text-[10px] font-medium text-slate-500 bg-slate-200/60 px-1.5 py-0.2 rounded font-mono">
                                  {device.fileName}
                                </span>
                              </h2>
                              <p className="text-[10px] text-slate-500">
                                Last synced {formatRelativeTime(device.lastUpdated)} &middot;{" "}
                                {deviceTabsCount} tabs &middot;{" "}
                                {deviceWorkspacesCount} workspaces
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {deviceBrowsers.map((b) => (
                              <span
                                key={b}
                                className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs"
                              >
                                {b}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Content Area: Zen Sidebar View or Zen Tree View */}
                        <div className="p-4 space-y-4">
                          {filteredRoots.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400">
                              No tree snapshots match the current filters inside {device.fileName}.
                            </div>
                          ) : viewMode === "zen_sidebar" ? (
                            /* Zen Browser Sidebar Mode */
                            <div className="space-y-6">
                              {browserGroups.map(([browserName, browserTrees]) => {
                                const workspaces = browserTrees.flatMap(extractWorkspacesFromRoot);
                                if (workspaces.length === 0) return null;

                                return (
                                  <div key={browserName} className="space-y-3">
                                    <div className="flex items-center gap-2 px-1">
                                      <span className="text-xs uppercase font-bold tracking-wider text-slate-500">
                                        {browserName}
                                      </span>
                                      <span className="text-[11px] font-medium text-slate-400">
                                        ({workspaces.length} {workspaces.length === 1 ? "workspace" : "workspaces"})
                                      </span>
                                    </div>
                                    {/* Arrange each workspace as a separate card in the grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
                                      {workspaces.map((wsItem) => (
                                        <ZenSidebarView
                                          key={wsItem.id}
                                          workspaceItem={wsItem}
                                          searchQuery={searchQuery}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            /* Zen Tree Hierarchy Mode */
                            <div className="space-y-1 max-h-[680px] overflow-y-auto zen-scrollbar">
                              {filteredRoots.map((node) => (
                                <TreeNodeItem
                                  key={node.id || `${node.browser_name}_${node.profile_name}_${node.sort_order}`}
                                  node={node}
                                  searchQuery={searchQuery}
                                  browserFilter={selectedBrowser}
                                  nodeTypeFilter={nodeTypeFilter}
                                  defaultExpanded={treeExpandedState}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 py-4 mt-auto text-center text-xs text-slate-500 bg-white">
        SyncTable Monorepo &middot; Desktop Daemon & Next.js Web App
      </footer>
    </main>
  );
}

