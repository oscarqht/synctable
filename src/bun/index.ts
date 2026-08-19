import { ApplicationMenu, BrowserView, BrowserWindow, defineElectrobunRPC } from "electrobun/bun";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";
import { SyncTableDB } from "./db";
import { BrowserSyncManager } from "./sync";
import type { SyncTableRPCSchema } from "../shared/types";

const db = new SyncTableDB();
const syncManager = new BrowserSyncManager(db);
const DEFAULT_WINDOW_FRAME = { x: 120, y: 80, width: 1150, height: 780 };
const savedWindowSize = db.getWindowSize();

if (platform() === "darwin") {
  ApplicationMenu.setApplicationMenu([
    {
      label: "SyncTable",
      submenu: [{ role: "quit", accelerator: "Command+Q" }],
    },
  ]);
}

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

// Background sync loop (1 minute)
const SYNC_INTERVAL_MS = 1 * 60 * 1000;
let autoSyncPaused = false;

function runAutoSync(reason: "periodic" | "resumed") {
  if (autoSyncPaused) {
    console.log("[SyncTable Daemon] Auto-sync paused while the session is inactive.");
    return;
  }

  try {
    console.log(`[SyncTable Daemon] Starting ${reason} background sync...`);
    const result = syncAndNotify();
    console.log(`[SyncTable Daemon] Auto-sync complete (${result.syncedNodesCount} nodes).`);
  } catch (err) {
    console.error("[SyncTable Daemon] Auto-sync error:", err);
  }
}

function findLifecycleMonitor() {
  const candidates = [
    join(process.cwd(), "src", "native", "bin", "sync-lifecycle-monitor"),
    join(import.meta.dir, "..", "native", "bin", "sync-lifecycle-monitor"),
    join(import.meta.dir, "..", "..", "bin", "sync-lifecycle-monitor"),
  ];
  return candidates.find(existsSync);
}

function monitorMacLifecycle() {
  if (platform() !== "darwin") return;

  const executable = findLifecycleMonitor();
  if (!executable) {
    console.error("[SyncTable Daemon] Lifecycle monitor is unavailable; auto-sync will continue normally.");
    return;
  }

  const monitor = Bun.spawn([executable], { stdout: "pipe", stderr: "inherit" });
  void (async () => {
    const decoder = new TextDecoder();
    let buffered = "";

    for await (const chunk of monitor.stdout) {
      buffered += decoder.decode(chunk, { stream: true });
      const states = buffered.split("\n");
      buffered = states.pop() ?? "";

      for (const state of states) {
        if (state === "paused" && !autoSyncPaused) {
          autoSyncPaused = true;
          console.log("[SyncTable Daemon] Auto-sync paused because macOS became inactive.");
        } else if (state === "resumed" && autoSyncPaused) {
          autoSyncPaused = false;
          console.log("[SyncTable Daemon] Auto-sync resumed because macOS became active.");
          runAutoSync("resumed");
        }
      }
    }
  })().catch((err) => console.error("[SyncTable Daemon] Lifecycle monitor error:", err));
}

monitorMacLifecycle();

setInterval(() => {
  runAutoSync("periodic");
}, SYNC_INTERVAL_MS);

console.log("SyncTable Electrobun main process initialized.");
