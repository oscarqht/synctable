import { BrowserView, BrowserWindow, defineElectrobunRPC } from "electrobun/bun";
import { SyncTableDB } from "./db";
import { BrowserSyncManager } from "./sync";
import type { SyncTableRPCSchema } from "../shared/types";

const db = new SyncTableDB();
const syncManager = new BrowserSyncManager(db);
const DEFAULT_WINDOW_FRAME = { x: 120, y: 80, width: 1150, height: 780 };
const savedWindowSize = db.getWindowSize();

const rpc = defineElectrobunRPC<SyncTableRPCSchema>("bun", {
  handlers: {
    requests: {
      getStats: () => {
        return syncManager.getStatsWithDetected();
      },
      getTree: (params) => {
        return db.getTree(params?.browserName, params?.profileName);
      },
      triggerSync: () => {
        const result = syncManager.runSync();
        return result;
      },
      getAppPreferences: () => {
        return db.getAppPreferences();
      },
      setSelectedBrowser: ({ selectedBrowser }) => {
        db.setSelectedBrowser(selectedBrowser);
      },
      setDeviceName: ({ deviceName }) => {
        db.setDeviceName(deviceName);
      },
    },
  },
});

// Create main window
const win = new BrowserWindow({
  title: "SyncTable",
  frame: {
    ...DEFAULT_WINDOW_FRAME,
    ...savedWindowSize,
  },
  url: "views://mainview/index.html",
  renderer: "native",
  rpc,
  titleBarStyle: "hiddenInset",
  transparent: false,
  passthrough: false,
  sandbox: false,
  html: null,
  preload: null,
  viewsRoot: null,
  navigationRules: null,
});

let saveWindowSizeTimer: Timer | undefined;
const saveWindowSize = (event: unknown) => {
  const { width, height } = (event as { data: { width: number; height: number } }).data;
  clearTimeout(saveWindowSizeTimer);
  saveWindowSizeTimer = setTimeout(() => db.setWindowSize(width, height), 250);
};

win.on("resize", saveWindowSize);
win.on("close", () => db.setWindowSize(win.getSize().width, win.getSize().height));

function syncAndNotify() {
  const result = syncManager.runSync();
  // The renderer performs the same reload after a manual Sync Now. Send the
  // matching event for daemon syncs so new/closed windows appear without a restart.
  const mainView = BrowserView.getById(win.webviewId);
  mainView?.rpc?.send.syncComplete(result);
  return result;
}

// Start from a fresh local snapshot instead of waiting for the first interval.
syncAndNotify();

// Background sync loop (10 minutes)
const SYNC_INTERVAL_MS = 10 * 60 * 1000;
setInterval(() => {
  try {
    console.log("[SyncTable Daemon] Starting periodic background sync...");
    const result = syncAndNotify();
    console.log(`[SyncTable Daemon] Auto-sync complete (${result.syncedNodesCount} nodes).`);
  } catch (err) {
    console.error("[SyncTable Daemon] Auto-sync error:", err);
  }
}, SYNC_INTERVAL_MS);

console.log("SyncTable Electrobun main process initialized.");
