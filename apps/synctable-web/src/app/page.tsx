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
  X,
} from "lucide-react";
import type {

  RaindropUserProfile,
  SynctableSyncResponse,
  BrowserTreeNode,
} from "@synctable/ui";
import {
  MultiDeviceCardsPortal,
  countTabs,
  countWorkspaces,
  pruneEmptyNodes,
} from "@synctable/ui";



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

  const [tokenInput, setTokenInput] = useState<string>("");
  const [tokenLoading, setTokenLoading] = useState<boolean>(false);

  const handleTokenLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = tokenInput.trim();
    if (!token) return;

    setTokenLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
      } else {
        setErrorMessage(data.error || "Failed to authenticate with token.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to authenticate with token.");
    } finally {
      setTokenLoading(false);
    }
  };

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
        if (res.status === 401) {
          setUser(null);
        }
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

  // Collect all unique browsers across non-empty devices, sorted by lastUpdateTime DESC
  const availableBrowsers = useMemo(() => {
    if (!validDevices.length) return [];
    const browserTimeMap = new Map<string, string>();
    for (const dev of validDevices) {
      for (const node of dev.tree) {
        if (node.browser_name && countTabs(node) > 0) {
          const b = node.browser_name.toLowerCase();
          const time = node.lastUpdateTime || node.snapshot_time || "";
          const existing = browserTimeMap.get(b) || "";
          if (time > existing) {
            browserTimeMap.set(b, time);
          }
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
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-50 via-blue-50/40 to-white border border-sky-200/60 flex items-center justify-center shadow-xs overflow-hidden select-none">
              <img src="/logo.png" alt="Synctable Logo" className="w-6 h-6 object-contain" />
            </div>
            <div className="flex flex-col sm:block justify-center">
              <div className="font-bold text-base tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent flex items-center gap-2">
                Synctable{" "}
                <span className="hidden sm:inline-flex text-[11px] font-semibold uppercase px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">
                  Web
                </span>
              </div>
              <p className="hidden sm:block text-[11px] text-slate-500">
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

                <div className="hidden sm:flex h-10 items-center space-x-2.5 bg-slate-100/90 border border-slate-200/90 rounded-xl pl-2 pr-3.5 backdrop-blur shadow-xs">
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
            <p className="text-sm">Loading Synctable...</p>
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

              <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-xl shadow-slate-200/60 space-y-5">
                <a
                  href="/api/auth/login"
                  className="w-full flex items-center justify-center space-x-2 py-3 px-6 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-medium text-sm shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Log in with Raindrop.io (OAuth)</span>
                </a>

                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-200 w-full"></div>
                  <span className="bg-white px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Or connect with API token
                  </span>
                </div>

                <form onSubmit={handleTokenLogin} className="space-y-3 text-left">
                  <div>
                    <label
                      htmlFor="raindrop-api-token"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Raindrop.io Test Token
                    </label>
                    <input
                      id="raindrop-api-token"
                      type="password"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="Paste your test token here"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-slate-800"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={tokenLoading || !tokenInput.trim()}
                    className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium text-xs shadow-sm transition-all"
                  >
                    {tokenLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    <span>Connect with API Token</span>
                  </button>
                  <p className="text-[11px] text-slate-500 text-center">
                    Get your test token from{" "}
                    <a
                      href="https://app.raindrop.io/settings/integrations"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-600 hover:underline"
                    >
                      Raindrop.io Settings → Integrations
                    </a>
                  </p>
                </form>
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
          /* AFTER LOGIN: Multi-Device Browser Tree Viewer using shared MultiDeviceCardsPortal */
          <div className="flex-1 flex flex-col space-y-6">
            <MultiDeviceCardsPortal
              data={syncData}
              loading={syncLoading}
              onRefresh={fetchSyncData}
            />
          </div>
        )}

      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 py-4 mt-auto text-center text-xs text-slate-500 bg-white">
        Synctable Monorepo &middot; Desktop Daemon & Next.js Web App
      </footer>
    </main>
  );
}

