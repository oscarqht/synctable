import { BrowserWindow, defineElectrobunRPC } from "electrobun/bun";
import { SyncTableDB } from "./db";
import { BrowserSyncManager } from "./sync";
import type { SyncTableRPCSchema } from "../shared/types";

const db = new SyncTableDB();
const syncManager = new BrowserSyncManager(db);

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
    },
  },
});

// Create main window
const win = new BrowserWindow({
  title: "SyncTable",
  frame: {
    x: 120,
    y: 80,
    width: 1150,
    height: 780,
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

// Background sync loop (10 minutes)
const SYNC_INTERVAL_MS = 10 * 60 * 1000;
setInterval(() => {
  try {
    console.log("[SyncTable Daemon] Starting periodic background sync...");
    const result = syncManager.runSync();
    console.log(`[SyncTable Daemon] Auto-sync complete (${result.syncedNodesCount} nodes).`);
  } catch (err) {
    console.error("[SyncTable Daemon] Auto-sync error:", err);
  }
}, SYNC_INTERVAL_MS);

console.log("SyncTable Electrobun main process initialized.");
