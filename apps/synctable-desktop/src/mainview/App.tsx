import React, { useState, useEffect, useCallback } from "react";
import { Settings, RefreshCw, Sparkles, Laptop, Cloud } from "lucide-react";
import type {
  BrowserTreeNode,
  SyncStats,
  SynctableSyncResponse,
  RaindropUserProfile,
} from "@synctable/ui";
import { MultiDeviceCardsPortal, countTabs } from "@synctable/ui";
import { LocalTab } from "./LocalTab";
import { SettingsModal } from "./SettingsModal";
import type { SynctableRPCSchema } from "../shared/types";

interface AppProps {
  rpc: any;
}

export function App({ rpc }: AppProps) {
  const [activeTab, setActiveTab] = useState<"local" | "cloud">("local");
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [trees, setTrees] = useState<BrowserTreeNode[]>([]);
  const [localSyncing, setLocalSyncing] = useState<boolean>(false);

  const [cloudData, setCloudData] = useState<SynctableSyncResponse | null>(null);
  const [cloudLoading, setCloudLoading] = useState<boolean>(false);

  const [savedDeviceName, setSavedDeviceName] = useState<string>("");
  const [savedRaindropToken, setSavedRaindropToken] = useState<string>("");
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Load preferences
  const loadPreferences = useCallback(async () => {
    try {
      const prefs = await rpc.request.getAppPreferences();
      setSavedDeviceName(prefs?.deviceName || "");
      setSavedRaindropToken(prefs?.raindropToken || "");
    } catch (err) {
      console.error("Failed to load preferences:", err);
    }
  }, [rpc]);

  // Load local trees & stats
  const loadLocalData = useCallback(async () => {
    try {
      const currentStats = await rpc.request.getStats();
      setStats(currentStats);
      const currentTrees = await rpc.request.getTree({});
      setTrees(currentTrees || []);
    } catch (err) {
      console.error("Failed to load local trees:", err);
    }
  }, [rpc]);

  // Load cloud multi-device data
  const loadCloudData = useCallback(
    async (isBackground = false, forceRefresh = false) => {
      if (!isBackground) setCloudLoading(true);
      try {
        const data: SynctableSyncResponse = await rpc.request.getCloudData(
          forceRefresh ? { forceRefresh: true } : undefined
        );
        if (data.authenticated && !data.error) {
          setCloudData(data);
        } else if (data.error) {
          // If we already have devices loaded, keep existing view on transient/background errors
          setCloudData((prev) => {
            if (!prev || prev.devices.length === 0) return data;
            return prev;
          });
        } else {
          setCloudData(data);
        }
      } catch (err: any) {
        console.error("Failed to load cloud sync data:", err);
        setCloudData((prev) => {
          if (!prev || prev.devices.length === 0) {
            return {
              authenticated: false,
              devices: [],
              error: err?.message || String(err),
            };
          }
          return prev;
        });
      } finally {
        if (!isBackground) setCloudLoading(false);
      }
    },
    [rpc]
  );

  // Initial load and syncComplete listener
  useEffect(() => {
    loadPreferences();
    loadLocalData();
    loadCloudData(true);

    const handleSyncEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.success) {
        loadLocalData();
        loadCloudData(true);
      }
    };

    window.addEventListener("synctable:syncComplete", handleSyncEvent);
    return () => {
      window.removeEventListener("synctable:syncComplete", handleSyncEvent);
    };
  }, [loadPreferences, loadLocalData, loadCloudData]);


  // Handle Tab Switch
  const handleTabSwitch = (tab: "local" | "cloud") => {
    setActiveTab(tab);
    if (tab === "local") {
      loadLocalData();
    } else {
      loadCloudData();
    }
  };

  // Handle Manual Sync Now
  const handleSyncNow = async () => {
    setLocalSyncing(true);
    try {
      const result = await rpc.request.triggerSync();
      if (result.success) {
        await loadLocalData();
        if (activeTab === "cloud") {
          await loadCloudData(true, true);
        }
      }
    } catch (err) {
      console.error("Manual sync failed:", err);
    } finally {
      setLocalSyncing(false);
    }
  };

  // Handle External URL open
  const handleOpenExternal = (url: string) => {
    rpc.request.openExternalURL({ url });
  };

  // Handle Save Token from inline form
  const handleSaveToken = async (token: string) => {
    await rpc.request.setRaindropToken({ token });
    setSavedRaindropToken(token);
    await loadPreferences();
    await loadCloudData(false, true);
  };

  // Handle Save Full Settings
  const handleSaveSettings = async (deviceName: string, token: string) => {
    await rpc.request.setDeviceName({ deviceName });
    await rpc.request.setRaindropToken({ token });
    setSavedDeviceName(deviceName);
    setSavedRaindropToken(token);
    await loadPreferences();
    await loadLocalData();
    await loadCloudData(false, true);
  };

  const validDevicesCount = (cloudData?.devices || []).filter(
    (d) => d.tree.reduce((acc, n) => acc + countTabs(n), 0) > 0
  ).length;

  const user = cloudData?.user;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans select-none">
      {/* Top Navigation Bar with macOS Inset Drag Area */}
      <header
        style={{ WebkitAppRegion: "drag", appRegion: "drag" } as React.CSSProperties}
        className="h-12 border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0 electrobun-webkit-app-region-drag titlebar-drag-region"
      >
        {/* Left: Brand with spacing for macOS traffic light buttons */}
        <div className="flex items-center space-x-2.5 pl-20">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-sky-50 via-blue-50/40 to-white dark:from-slate-800 dark:via-slate-800/60 dark:to-slate-900 border border-sky-200/60 dark:border-slate-700/60 flex items-center justify-center shadow-xs overflow-hidden select-none">
            <img src="assets/logo.png" alt="Synctable" className="w-5 h-5 object-contain" />
          </div>
          <div className="hidden min-[720px]:flex items-baseline space-x-1.5">
            <span className="text-xs font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Synctable
            </span>
            <span className="text-[10px] font-medium text-slate-400 font-mono">
              v0.1.0
            </span>
          </div>
        </div>

        {/* Center: Segmented Tab Switcher */}
        <div
          style={{ WebkitAppRegion: "no-drag", appRegion: "no-drag" } as React.CSSProperties}
          className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 electrobun-webkit-app-region-no-drag titlebar-no-drag"
        >
          <button
            onClick={() => handleTabSwitch("local")}
            className={`flex items-center space-x-1.5 px-3.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "local"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>💻</span>
            <span>Current Device</span>
          </button>

          <button
            onClick={() => handleTabSwitch("cloud")}
            className={`flex items-center space-x-1.5 px-3.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "cloud"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>☁️</span>
            <span>All Devices</span>
            {validDevicesCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300">
                {validDevicesCount}
              </span>
            )}
          </button>
        </div>

        {/* Right: User Pill & Settings */}
        <div
          style={{ WebkitAppRegion: "no-drag", appRegion: "no-drag" } as React.CSSProperties}
          className="flex items-center space-x-2 electrobun-webkit-app-region-no-drag titlebar-no-drag"
        >
          {user && (
            <div className="hidden min-[720px]:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="w-4 h-4 rounded-full object-cover"
                />
              ) : (
                <span className="w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-700 text-[10px] font-bold flex items-center justify-center">
                  {(user.name || "U").charAt(0).toUpperCase()}
                </span>
              )}
              <span className="font-semibold truncate max-w-[100px]">
                {user.name}
              </span>
              {user.isPro && (
                <span className="text-[9px] font-extrabold uppercase px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60">
                  PRO
                </span>
              )}
            </div>
          )}

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-7 h-7 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content View */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === "local" ? (
          <div className="flex-1 p-5 overflow-y-auto zen-scrollbar">
            <LocalTab
              stats={stats}
              trees={trees}
              syncing={localSyncing}
              onSync={handleSyncNow}
              onOpenExternal={handleOpenExternal}
              deviceName={savedDeviceName}
            />
          </div>
        ) : (
          <div className="flex-1 p-5 overflow-y-auto zen-scrollbar">
            <MultiDeviceCardsPortal
              data={cloudData}
              loading={cloudLoading}
              onRefresh={() => loadCloudData(false, true)}
              onOpenExternal={handleOpenExternal}
              onSaveToken={handleSaveToken}
              onSwitchToLocal={() => setActiveTab("local")}
            />
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        savedDeviceName={savedDeviceName}
        savedRaindropToken={savedRaindropToken}
        onSave={handleSaveSettings}
        onOpenExternal={handleOpenExternal}
      />
    </div>
  );
}
