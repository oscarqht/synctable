import { homedir, platform } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, cpSync, readdirSync, rmSync } from "node:fs";
import type { InstalledBrowser } from "../shared/types";

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
    supportsOfflineInjection: false,
  },
  {
    id: "zen",
    name: "Zen Browser",
    bundleId: "app.zen-browser.zen",
    appNames: ["Zen", "Zen Browser", "Zen.app", "Zen Browser.app"],
    supportsOfflineInjection: false,
  },
  {
    id: "chrome",
    name: "Google Chrome",
    bundleId: "com.google.Chrome",
    appNames: ["Google Chrome", "Google Chrome.app", "Chrome"],
    // Chrome 151 resets the injected startup preference using its protected
    // preferences MAC, then discards the staged session on launch.
    supportsOfflineInjection: false,
  },
  {
    id: "firefox",
    name: "Firefox",
    bundleId: "org.mozilla.firefox",
    appNames: ["Firefox", "Firefox.app"],
    supportsOfflineInjection: false,
  },
  {
    id: "vivaldi",
    name: "Vivaldi",
    bundleId: "com.vivaldi.Vivaldi",
    appNames: ["Vivaldi", "Vivaldi.app"],
    // Keep disabled until the same launch-level validation passes for Vivaldi.
    supportsOfflineInjection: false,
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
    supportsOfflineInjection: false,
  },
  {
    id: "brave",
    name: "Brave Browser",
    bundleId: "com.brave.Browser",
    appNames: ["Brave Browser", "Brave Browser.app", "Brave"],
    supportsOfflineInjection: false,
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
      const proc = Bun.spawn(["pgrep", "-x", cleanName], { stdout: "pipe", stderr: "pipe" });
      const code = await proc.exited;
      if (code === 0) return true;
    }

    // Also check pgrep -f for .app/Contents/MacOS
    for (const name of b.appNames) {
      const cleanName = name.replace(/\.app$/, "");
      const proc = Bun.spawn(["pgrep", "-f", `${cleanName}.app/Contents/MacOS`], { stdout: "pipe", stderr: "pipe" });
      const code = await proc.exited;
      if (code === 0) return true;
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

  // Wait up to 2 seconds for graceful quit
  for (let i = 0; i < 8; i++) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const running = await isBrowserRunning(browser);
    if (!running) return true;
  }

  // 2. Force terminate with pkill -9 if still running
  try {
    for (const name of b.appNames) {
      const cleanName = name.replace(/\.app$/, "");
      const p1 = Bun.spawn(["pkill", "-9", "-x", cleanName], { stdout: "pipe", stderr: "pipe" });
      await p1.exited;
      const p2 = Bun.spawn(["pkill", "-9", "-f", `${cleanName}.app/Contents/MacOS`], { stdout: "pipe", stderr: "pipe" });
      await p2.exited;
    }
  } catch {
    // ignore
  }

  await new Promise((resolve) => setTimeout(resolve, 300));
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

  if (b === "zen") {
    const zenProfilesDir = join(appSupport, "zen", "Profiles");
    if (existsSync(zenProfilesDir)) {
      const entries = readdirSync(zenProfilesDir);
      const chosen = entries.find((e) => profileName ? e === profileName || e.includes(profileName) : e.includes("release") || e.includes("Default")) || entries[0];
      if (chosen) {
        const fullProf = join(zenProfilesDir, chosen);
        mkdirSync(backupDir, { recursive: true });
        const rec = join(fullProf, "sessionstore-backups", "recovery.jsonlz4");
        const sess = join(fullProf, "sessionstore.jsonlz4");
        if (existsSync(rec)) cpSync(rec, join(backupDir, "recovery.jsonlz4"));
        if (existsSync(sess)) cpSync(sess, join(backupDir, "sessionstore.jsonlz4"));
        return backupDir;
      }
    }
  }

  if (b === "firefox") {
    const ffProfilesDir = join(appSupport, "Firefox", "Profiles");
    if (existsSync(ffProfilesDir)) {
      const entries = readdirSync(ffProfilesDir);
      const chosen = entries.find((e) => profileName ? e === profileName || e.includes(profileName) : e.includes("default-release") || e.includes("default")) || entries[0];
      if (chosen) {
        const fullProf = join(ffProfilesDir, chosen);
        mkdirSync(backupDir, { recursive: true });
        const rec = join(fullProf, "sessionstore-backups", "recovery.jsonlz4");
        const sess = join(fullProf, "sessionstore.jsonlz4");
        if (existsSync(rec)) cpSync(rec, join(backupDir, "recovery.jsonlz4"));
        if (existsSync(sess)) cpSync(sess, join(backupDir, "sessionstore.jsonlz4"));
        return backupDir;
      }
    }
  }

  // Chromium based browsers (Chrome, Vivaldi, Brave, Edge)
  const chromiumBaseDirMap: Record<string, string> = {
    chrome: join(appSupport, "Google", "Chrome"),
    vivaldi: join(appSupport, "Vivaldi"),
    brave: join(appSupport, "BraveSoftware", "Brave-Browser"),
    edge: join(appSupport, "Microsoft Edge"),
  };

  if (chromiumBaseDirMap[b] && existsSync(chromiumBaseDirMap[b])) {
    const base = chromiumBaseDirMap[b];
    const entries = readdirSync(base);
    const chosen = profileName && entries.includes(profileName)
      ? profileName
      : entries.includes("Default")
        ? "Default"
        : entries.find((e) => e.startsWith("Profile "));

    if (chosen) {
      const fullProf = join(base, chosen);
      const sessionsDir = join(fullProf, "Sessions");
      const prefFile = join(fullProf, "Preferences");

      mkdirSync(backupDir, { recursive: true });
      let copiedState = false;
      if (existsSync(sessionsDir)) {
        cpSync(sessionsDir, join(backupDir, "Sessions"), { recursive: true });
        copiedState = true;
      }
      if (existsSync(prefFile)) {
        cpSync(prefFile, join(backupDir, "Preferences"));
        copiedState = true;
      }
      return copiedState ? backupDir : null;
    }
  }

  return null;
}

/** Restores the state captured by backupBrowserSession into the selected internal profile. */
export async function restoreBrowserSessionBackup(browser: string, backupDir: string, profileName?: string): Promise<boolean> {
  try {
    const home = homedir();
    const appSupport = join(home, "Library", "Application Support");
    const b = browser.toLowerCase();
    if (b === "chrome" || b === "vivaldi" || b === "brave" || b === "edge") {
      const bases: Record<string, string> = {
        chrome: join(appSupport, "Google", "Chrome"),
        vivaldi: join(appSupport, "Vivaldi"),
        brave: join(appSupport, "BraveSoftware", "Brave-Browser"),
        edge: join(appSupport, "Microsoft Edge"),
      };
      const profile = profileName || "Default";
      const target = join(bases[b], profile);
      const sessionBackup = join(backupDir, "Sessions");
      const preferencesBackup = join(backupDir, "Preferences");
      if (!existsSync(sessionBackup) && !existsSync(preferencesBackup)) return false;
      if (existsSync(sessionBackup)) {
        rmSync(join(target, "Sessions"), { recursive: true, force: true });
        cpSync(sessionBackup, join(target, "Sessions"), { recursive: true, force: true });
      }
      if (existsSync(preferencesBackup)) {
        cpSync(preferencesBackup, join(target, "Preferences"), { force: true });
      }
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export async function relaunchBrowser(browser: string): Promise<void> {
  if (platform() !== "darwin") return;
  const b = KNOWN_BROWSERS.find((k) => k.id === browser.toLowerCase());
  const target = b ? b.appNames[0].replace(/\.app$/, "") : browser;

  Bun.spawn(["open", "-a", target]);
}

export async function waitForBrowserLaunch(browser: string, timeoutMs = 8000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isBrowserRunning(browser)) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}
