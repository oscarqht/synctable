import { homedir } from "node:os";
import { join } from "node:path";
import { readdirSync, existsSync } from "node:fs";
import { serializeToArcSidebar } from "./arcSerializer";
import { serializeToZenSession } from "./zenSerializer";
import { serializeToChromiumSession } from "./chromiumSerializer";
import { extractTreeStats, type BrowserTreeNode } from "@synctable/ui";

export interface SessionRestoreOptions {
  targetBrowser: string;
  mode?: "merge" | "overwrite";
  profileName?: string;
}

function findChromiumProfileDir(baseDir: string, preferredProfile?: string): string | null {
  if (!existsSync(baseDir)) return null;
  const entries = readdirSync(baseDir);
  if (preferredProfile && entries.includes(preferredProfile)) {
    return join(baseDir, preferredProfile);
  }
  if (entries.includes("Default")) return join(baseDir, "Default");
  const prof = entries.find((e) => e.startsWith("Profile "));
  if (prof) return join(baseDir, prof);
  return null;
}

export function getTargetBrowserStatePaths(browser: string, profileName?: string): {
  browser: string;
  sourceFileOrDir: string;
  appBundleId?: string;
  appName?: string;
} | null {
  const home = homedir();
  const appSupport = join(home, "Library", "Application Support");

  const b = browser.toLowerCase();
  if (b === "arc") {
    const arcPath = join(appSupport, "Arc", "StorableSidebar.json");
    return {
      browser: "arc",
      sourceFileOrDir: arcPath,
      appBundleId: "company.thebrowser.Browser",
      appName: "Arc",
    };
  }

  if (b === "zen") {
    const zenProfilesDir = join(appSupport, "zen", "Profiles");
    if (existsSync(zenProfilesDir)) {
      const entries = readdirSync(zenProfilesDir);
      const chosen = entries.find((e) => profileName ? e === profileName || e.includes(profileName) : e.includes("release") || e.includes("Default")) || entries[0];
      if (chosen) {
        return {
          browser: "zen",
          sourceFileOrDir: join(zenProfilesDir, chosen),
          appBundleId: "app.zen-browser.zen",
          appName: "Zen",
        };
      }
    }
  }

  if (b === "firefox") {
    const ffProfilesDir = join(appSupport, "Firefox", "Profiles");
    if (existsSync(ffProfilesDir)) {
      const entries = readdirSync(ffProfilesDir);
      const chosen = entries.find((e) => profileName ? e === profileName || e.includes(profileName) : e.includes("default-release") || e.includes("default")) || entries[0];
      if (chosen) {
        return {
          browser: "firefox",
          sourceFileOrDir: join(ffProfilesDir, chosen),
          appBundleId: "org.mozilla.firefox",
          appName: "Firefox",
        };
      }
    }
  }

  if (b === "chrome") {
    const chromeDir = join(appSupport, "Google", "Chrome");
    const profDir = findChromiumProfileDir(chromeDir, profileName);
    if (profDir) {
      return {
        browser: "chrome",
        sourceFileOrDir: profDir,
        appBundleId: "com.google.Chrome",
        appName: "Google Chrome",
      };
    }
  }

  if (b === "vivaldi") {
    const vivaldiDir = join(appSupport, "Vivaldi");
    const profDir = findChromiumProfileDir(vivaldiDir, profileName);
    if (profDir) {
      return {
        browser: "vivaldi",
        sourceFileOrDir: profDir,
        appBundleId: "com.vivaldi.Vivaldi",
        appName: "Vivaldi",
      };
    }
  }

  if (b === "brave") {
    const braveDir = join(appSupport, "BraveSoftware", "Brave-Browser");
    const profDir = findChromiumProfileDir(braveDir, profileName);
    if (profDir) {
      return {
        browser: "brave",
        sourceFileOrDir: profDir,
        appBundleId: "com.brave.Browser",
        appName: "Brave Browser",
      };
    }
  }

  if (b === "edge") {
    const edgeDir = join(appSupport, "Microsoft Edge");
    const profDir = findChromiumProfileDir(edgeDir, profileName);
    if (profDir) {
      return {
        browser: "edge",
        sourceFileOrDir: profDir,
        appBundleId: "com.microsoft.edgemac",
        appName: "Microsoft Edge",
      };
    }
  }

  return null;
}

export function serializeAndInjectSession(
  nodes: BrowserTreeNode[],
  options: SessionRestoreOptions
): {
  success: boolean;
  stats: { workspaces: number; folders: number; splitViews: number; tabs: number };
  error?: string;
} {
  const b = options.targetBrowser.toLowerCase();
  const stats = extractTreeStats(nodes);

  if (b === "arc") {
    const paths = getTargetBrowserStatePaths("arc");
    if (!paths) {
      return { success: false, stats, error: "Arc profile directory not found on this system." };
    }

    const result = serializeToArcSidebar(nodes, {
      targetFilePath: paths.sourceFileOrDir,
      mode: options.mode || "merge",
    });

    if (!result.success) {
      return { success: false, stats, error: result.error || "Failed to serialize Arc session" };
    }

    return { success: true, stats };
  }

  if (b === "zen" || b === "firefox") {
    const paths = getTargetBrowserStatePaths(b, options.profileName);
    if (!paths) {
      return { success: false, stats, error: `${b === "zen" ? "Zen Browser" : "Firefox"} profile directory not found.` };
    }

    const result = serializeToZenSession(nodes, {
      profilePath: paths.sourceFileOrDir,
      mode: options.mode || "merge",
    });

    if (!result.success) {
      return { success: false, stats, error: result.error || "Failed to serialize Zen/Firefox session" };
    }

    return { success: true, stats };
  }

  if (b === "chrome" || b === "vivaldi" || b === "brave" || b === "edge") {
    const paths = getTargetBrowserStatePaths(b, options.profileName);
    if (!paths) {
      return { success: false, stats, error: `${options.targetBrowser} profile directory not found on this system.` };
    }

    const result = serializeToChromiumSession(nodes, {
      profilePath: paths.sourceFileOrDir,
      browserName: b,
      mode: options.mode || "merge",
    });

    if (!result.success) {
      return { success: false, stats, error: result.error || `Failed to serialize ${b} session` };
    }

    return { success: true, stats };
  }

  return {
    success: false,
    stats,
    error: `Offline file injection is currently supported for Arc, Zen, Firefox, Chrome, Vivaldi, Brave, and Edge. For ${options.targetBrowser}, please use Tab Launch restoration.`,
  };
}
