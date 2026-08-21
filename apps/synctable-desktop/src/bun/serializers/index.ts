import { homedir, tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from "node:fs";
import { serializeToArcSidebar } from "./arcSerializer";
import { serializeToZenSession } from "./zenSerializer";
import { serializeToChromiumSession } from "./chromiumSerializer";
import { extractTreeStats, type BrowserTreeNode } from "@synctable/ui";

export interface SessionRestoreOptions {
  targetBrowser: string;
  mode?: "merge" | "overwrite";
  profileName?: string;
}

export interface StagedSessionRestore {
  stagingDir: string;
  artifacts: Array<{ stagedPath: string; targetPath: string }>;
  stats: { workspaces: number; folders: number; splitViews: number; tabs: number };
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
  profileName?: string;
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
          profileName: chosen,
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
          profileName: chosen,
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
        profileName: basename(profDir),
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
        profileName: basename(profDir),
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
        profileName: basename(profDir),
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
        profileName: basename(profDir),
      };
    }
  }

  return null;
}

function stateArtifacts(browser: string, targetPath: string, stagingDir: string): Array<{ stagedPath: string; targetPath: string }> {
  if (browser === "zen") {
    return [
      { targetPath: join(targetPath, "sessionstore-backups", "recovery.jsonlz4"), stagedPath: join(stagingDir, "profile", "sessionstore-backups", "recovery.jsonlz4") },
      { targetPath: join(targetPath, "sessionstore.jsonlz4"), stagedPath: join(stagingDir, "profile", "sessionstore.jsonlz4") },
    ];
  }
  if (browser === "arc") {
    return [{ targetPath, stagedPath: join(stagingDir, "StorableSidebar.json") }];
  }
  return [
    { targetPath: join(targetPath, "Sessions"), stagedPath: join(stagingDir, "profile", "Sessions") },
    { targetPath: join(targetPath, "Preferences"), stagedPath: join(stagingDir, "profile", "Preferences") },
  ];
}

function copyIfPresent(source: string, destination: string): void {
  if (!existsSync(source)) return;
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
}

/** Builds the replacement state outside the live browser profile. */
export function stageSessionInjection(
  nodes: BrowserTreeNode[],
  options: SessionRestoreOptions
): { success: true; staged: StagedSessionRestore } | { success: false; stats: StagedSessionRestore["stats"]; error: string } {
  const stats = extractTreeStats(nodes);
  const target = getTargetBrowserStatePaths(options.targetBrowser);
  if (!target) return { success: false, stats, error: `${options.targetBrowser} does not have a local browser profile to restore.` };

  const stagingDir = mkdtempSync(join(tmpdir(), "synctable-session-restore-"));
  const artifacts = stateArtifacts(target.browser, target.sourceFileOrDir, stagingDir);
  try {
    for (const artifact of artifacts) copyIfPresent(artifact.targetPath, artifact.stagedPath);
    const stagedTarget = target.browser === "arc" ? artifacts[0].stagedPath : join(stagingDir, "profile");
    const result = serializeAndInjectSession(nodes, { ...options, targetBrowser: target.browser }, stagedTarget);
    if (!result.success) {
      rmSync(stagingDir, { recursive: true, force: true });
      return { success: false, stats, error: result.error || "Could not build restored browser state." };
    }
    return { success: true, staged: { stagingDir, artifacts, stats } };
  } catch (error: any) {
    rmSync(stagingDir, { recursive: true, force: true });
    return { success: false, stats, error: error?.message || String(error) };
  }
}

/** Replaces each staged artifact with a same-volume rename, after the app exits. */
export function commitStagedSession(staged: StagedSessionRestore): void {
  for (const { stagedPath, targetPath } of staged.artifacts) {
    if (!existsSync(stagedPath)) continue;
    const replacement = join(dirname(targetPath), `.${basename(targetPath)}.synctable-new`);
    const previous = join(dirname(targetPath), `.${basename(targetPath)}.synctable-old`);
    rmSync(replacement, { recursive: true, force: true });
    rmSync(previous, { recursive: true, force: true });
    mkdirSync(dirname(targetPath), { recursive: true });
    cpSync(stagedPath, replacement, { recursive: true });
    if (existsSync(targetPath)) renameSync(targetPath, previous);
    try {
      renameSync(replacement, targetPath);
      rmSync(previous, { recursive: true, force: true });
    } catch (error) {
      if (existsSync(previous)) renameSync(previous, targetPath);
      throw error;
    }
  }
}

export function discardStagedSession(staged: StagedSessionRestore): void {
  rmSync(staged.stagingDir, { recursive: true, force: true });
}

export function serializeAndInjectSession(
  nodes: BrowserTreeNode[],
  options: SessionRestoreOptions,
  targetPathOverride?: string
): {
  success: boolean;
  stats: { workspaces: number; folders: number; splitViews: number; tabs: number };
  error?: string;
} {
  const b = options.targetBrowser.toLowerCase();
  const stats = extractTreeStats(nodes);

  if (b === "arc") {
    const paths = targetPathOverride ? { sourceFileOrDir: targetPathOverride } : getTargetBrowserStatePaths("arc");
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

  if (b === "zen") {
    const paths = targetPathOverride ? { sourceFileOrDir: targetPathOverride } : getTargetBrowserStatePaths(b, options.profileName);
    if (!paths) {
      return { success: false, stats, error: "Zen Browser profile directory not found." };
    }

    const result = serializeToZenSession(nodes, {
      profilePath: paths.sourceFileOrDir,
      mode: options.mode || "merge",
    });

    if (!result.success) {
      return { success: false, stats, error: result.error || "Failed to serialize Zen session" };
    }

    return { success: true, stats };
  }

  if (b === "chrome" || b === "vivaldi") {
    const paths = targetPathOverride ? { sourceFileOrDir: targetPathOverride } : getTargetBrowserStatePaths(b, options.profileName);
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
    error: `Offline file injection is not currently validated for ${options.targetBrowser}. Please use Tab Launch restoration.`,
  };
}
