import { homedir, platform } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import type { InstalledBrowser } from "../shared/types";
import { resolveMozillaProfileDir, findChromiumProfileDir } from "./serializers";

export interface BrowserAppInfo {
  id: string;
  name: string;
  bundleId: string;
  appNames: string[];
  supportsOfflineInjection: boolean;
}

export const KNOWN_BROWSERS: BrowserAppInfo[] = [
  {
    id: "arc",
    name: "Arc Browser",
    bundleId: "company.thebrowser.Browser",
    appNames: ["Arc", "Arc.app"],
    supportsOfflineInjection: true,
  },
  {
    id: "zen",
    name: "Zen Browser",
    bundleId: "app.zen-browser.zen",
    appNames: ["Zen", "Zen Browser", "Zen.app", "Zen Browser.app"],
    supportsOfflineInjection: true,
  },
  {
    id: "chrome",
    name: "Google Chrome",
    bundleId: "com.google.Chrome",
    appNames: ["Google Chrome", "Google Chrome.app", "Chrome"],
    supportsOfflineInjection: true,
  },
  {
    id: "firefox",
    name: "Firefox",
    bundleId: "org.mozilla.firefox",
    appNames: ["Firefox", "Firefox.app"],
    supportsOfflineInjection: true,
  },
  {
    id: "vivaldi",
    name: "Vivaldi",
    bundleId: "com.vivaldi.Vivaldi",
    appNames: ["Vivaldi", "Vivaldi.app"],
    supportsOfflineInjection: true,
  },
  {
    id: "safari",
    name: "Safari",
    bundleId: "com.apple.Safari",
    appNames: ["Safari", "Safari.app"],
    supportsOfflineInjection: false,
  },
  {
    id: "dia",
    name: "Dia Browser",
    bundleId: "company.thebrowser.dia",
    appNames: ["Dia", "Dia.app"],
    supportsOfflineInjection: false,
  },
  {
    id: "edge",
    name: "Microsoft Edge",
    bundleId: "com.microsoft.edgemac",
    appNames: ["Microsoft Edge", "Microsoft Edge.app", "Edge"],
    supportsOfflineInjection: true,
  },
  {
    id: "brave",
    name: "Brave Browser",
    bundleId: "com.brave.Browser",
    appNames: ["Brave Browser", "Brave Browser.app", "Brave"],
    supportsOfflineInjection: true,
  },
];

export async function getDefaultBrowserBundleId(): Promise<string | null> {
  if (platform() !== "darwin") return null;
  try {
    const proc = Bun.spawn(
      ["defaults", "read", "com.apple.LaunchServices/com.apple.launchservices.secure", "LSHandlers"],
      { stdout: "pipe", stderr: "pipe" }
    );
    const text = await new Response(proc.stdout).text();
    // Look for LSHandlerURLScheme = https; followed or preceded by LSHandlerRoleAll
    const httpsMatch = text.match(/LSHandlerRoleAll\s*=\s*"([^"]+)";[\s\S]*?LSHandlerURLScheme\s*=\s*https;/i) ||
                       text.match(/LSHandlerURLScheme\s*=\s*https;[\s\S]*?LSHandlerRoleAll\s*=\s*"([^"]+)";/i);
    return httpsMatch ? httpsMatch[1].trim() : null;
  } catch {
    return null;
  }
}

export async function getInstalledBrowsers(): Promise<InstalledBrowser[]> {
  if (platform() !== "darwin") {
    return [
      { id: "default", name: "System Default Browser", isDefault: true, supportsOfflineInjection: false },
    ];
  }

  const defaultBundle = await getDefaultBrowserBundleId();
  const installed: InstalledBrowser[] = [];

  const appDirs = ["/Applications", join(homedir(), "Applications")];

  for (const b of KNOWN_BROWSERS) {
    let foundPath: string | null = null;
    for (const dir of appDirs) {
      for (const name of b.appNames) {
        const full = join(dir, name.endsWith(".app") ? name : `${name}.app`);
        if (existsSync(full)) {
          foundPath = full;
          break;
        }
      }
      if (foundPath) break;
    }

    if (foundPath) {
      const isDef = defaultBundle ? defaultBundle.toLowerCase() === b.bundleId.toLowerCase() : false;
      installed.push({
        id: b.id,
        name: b.name,
        bundleId: b.bundleId,
        appPath: foundPath,
        isDefault: isDef,
        supportsOfflineInjection: b.supportsOfflineInjection,
      });
    }
  }

  // Prepend default browser entry if needed
  const defaultEntry: InstalledBrowser = {
    id: "default",
    name: defaultBundle
      ? `System Default (${installed.find((i) => i.isDefault)?.name || defaultBundle})`
      : "System Default Browser",
    isDefault: true,
    supportsOfflineInjection: false,
  };

  return [defaultEntry, ...installed.map((i) => ({ ...i, isDefault: i.isDefault }))];
}

export async function isBrowserRunning(browser: string): Promise<boolean> {
  if (platform() !== "darwin") return false;
  const b = KNOWN_BROWSERS.find((k) => k.id === browser.toLowerCase()) || {
    id: browser,
    name: browser,
    bundleId: browser,
    appNames: [browser],
    supportsOfflineInjection: false,
  };

  try {
    for (const name of b.appNames) {
      const cleanName = name.replace(/\.app$/, "");
      const p1 = Bun.spawn(["pgrep", "-i", "-x", cleanName], { stdout: "pipe", stderr: "pipe" });
      if ((await p1.exited) === 0) return true;

      const p2 = Bun.spawn(["pgrep", "-i", "-f", `${cleanName}.app/Contents/MacOS`], { stdout: "pipe", stderr: "pipe" });
      if ((await p2.exited) === 0) return true;
    }

    const commonBinaries: Record<string, string[]> = {
      firefox: ["firefox", "firefox-bin"],
      zen: ["zen", "zen-bin"],
      chrome: ["Google Chrome", "chrome"],
      arc: ["Arc"],
      vivaldi: ["Vivaldi"],
      brave: ["Brave Browser", "brave"],
      edge: ["Microsoft Edge", "msedge"],
    };

    const bins = commonBinaries[browser.toLowerCase()] || [];
    for (const bin of bins) {
      const p = Bun.spawn(["pgrep", "-i", "-x", bin], { stdout: "pipe", stderr: "pipe" });
      if ((await p.exited) === 0) return true;
    }

    return false;
  } catch {
    return false;
  }
}

export async function killBrowserProcess(browser: string): Promise<boolean> {
  if (platform() !== "darwin") return true;
  const b = KNOWN_BROWSERS.find((k) => k.id === browser.toLowerCase()) || {
    id: browser,
    name: browser,
    bundleId: browser,
    appNames: [browser],
    supportsOfflineInjection: false,
  };

  const appName = b.appNames[0].replace(/\.app$/, "");

  // 1. Try graceful AppleScript quit
  try {
    const graceful = Bun.spawn(["osascript", "-e", `tell application "${appName}" to quit`], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await graceful.exited;
  } catch {
    // Ignore error and proceed to verification
  }

  // Wait up to 3 seconds for graceful quit
  for (let i = 0; i < 12; i++) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const running = await isBrowserRunning(browser);
    if (!running) {
      // Extra cushion to ensure all child processes and file write buffers are finished
      await new Promise((resolve) => setTimeout(resolve, 300));
      return true;
    }
  }

  // 2. Force terminate with pkill -9 if still running
  try {
    for (const name of b.appNames) {
      const cleanName = name.replace(/\.app$/, "");
      const p1 = Bun.spawn(["pkill", "-9", "-i", "-x", cleanName], { stdout: "pipe", stderr: "pipe" });
      await p1.exited;
      const p2 = Bun.spawn(["pkill", "-9", "-i", "-f", `${cleanName}.app/Contents/MacOS`], { stdout: "pipe", stderr: "pipe" });
      await p2.exited;
    }

    const commonBinaries: Record<string, string[]> = {
      firefox: ["firefox", "firefox-bin"],
      zen: ["zen", "zen-bin"],
      chrome: ["Google Chrome", "chrome"],
      arc: ["Arc"],
      vivaldi: ["Vivaldi"],
      brave: ["Brave Browser", "brave"],
      edge: ["Microsoft Edge", "msedge"],
    };

    const bins = commonBinaries[browser.toLowerCase()] || [];
    for (const bin of bins) {
      const p = Bun.spawn(["pkill", "-9", "-i", "-x", bin], { stdout: "pipe", stderr: "pipe" });
      await p.exited;
    }
  } catch {
    // ignore
  }

  await new Promise((resolve) => setTimeout(resolve, 500));
  return !(await isBrowserRunning(browser));
}

export async function backupBrowserSession(browser: string, profileName?: string): Promise<string | null> {
  const home = homedir();
  const backupsBase = join(home, ".browser_sync_cache", "backups");
  mkdirSync(backupsBase, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const b = browser.toLowerCase();
  const backupDir = join(backupsBase, `${b}_backup_${timestamp}`);

  const appSupport = join(home, "Library", "Application Support");

  if (b === "arc") {
    const arcSidebar = join(appSupport, "Arc", "StorableSidebar.json");
    if (existsSync(arcSidebar)) {
      mkdirSync(backupDir, { recursive: true });
      cpSync(arcSidebar, join(backupDir, "StorableSidebar.json"));
      return backupDir;
    }
  }

  if (b === "zen" || b === "firefox") {
    const baseDir = join(appSupport, b === "zen" ? "zen" : "Firefox");
    const fullProf = resolveMozillaProfileDir(baseDir, profileName);
    if (fullProf && existsSync(fullProf)) {
      mkdirSync(backupDir, { recursive: true });
      const rec = join(fullProf, "sessionstore-backups", "recovery.jsonlz4");
      const sess = join(fullProf, "sessionstore.jsonlz4");
      const userJs = join(fullProf, "user.js");
      const prefsJs = join(fullProf, "prefs.js");

      if (existsSync(rec)) cpSync(rec, join(backupDir, "recovery.jsonlz4"));
      if (existsSync(sess)) cpSync(sess, join(backupDir, "sessionstore.jsonlz4"));
      if (existsSync(userJs)) cpSync(userJs, join(backupDir, "user.js"));
      if (existsSync(prefsJs)) cpSync(prefsJs, join(backupDir, "prefs.js"));
      return backupDir;
    }
  }

  // Chromium based browsers (Chrome, Vivaldi, Brave, Edge)
  const chromiumBaseDirMap: Record<string, string> = {
    chrome: join(appSupport, "Google", "Chrome"),
    vivaldi: join(appSupport, "Vivaldi"),
    brave: join(appSupport, "BraveSoftware", "Brave-Browser"),
    edge: join(appSupport, "Microsoft Edge"),
  };

  if (chromiumBaseDirMap[b]) {
    const fullProf = findChromiumProfileDir(chromiumBaseDirMap[b], profileName);
    if (fullProf && existsSync(fullProf)) {
      const sessionsDir = join(fullProf, "Sessions");
      const prefFile = join(fullProf, "Preferences");

      mkdirSync(backupDir, { recursive: true });
      if (existsSync(sessionsDir)) {
        cpSync(sessionsDir, join(backupDir, "Sessions"), { recursive: true });
      }
      if (existsSync(prefFile)) {
        cpSync(prefFile, join(backupDir, "Preferences"));
      }
      return backupDir;
    }
  }

  return null;
}

export async function relaunchBrowser(browser: string): Promise<void> {
  if (platform() !== "darwin") return;
  const b = KNOWN_BROWSERS.find((k) => k.id === browser.toLowerCase());
  const target = b ? b.appNames[0].replace(/\.app$/, "") : browser;

  Bun.spawn(["open", "-a", target]);
}
