import { existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";
import type { BrowserTreeNode, OSType, SyncResult, SyncStats } from "../shared/types";
import { parseArcSidebar, parseChromePreferences, parseVivaldiPreferences, parseZenSessionstore } from "./parsers";
import type { SyncTableDB } from "./db";

export class BrowserSyncManager {
  private db: SyncTableDB;
  private osType: OSType;
  private cacheDir: string;

  constructor(db: SyncTableDB) {
    this.db = db;
    this.osType = this.detectOSType();
    this.cacheDir = join(homedir(), ".browser_sync_cache", "tmp");
    mkdirSync(this.cacheDir, { recursive: true });
  }

  private detectOSType(): OSType {
    const p = platform();
    if (p === "darwin") return "macos";
    if (p === "win32") return "windows";
    return "linux";
  }

  public getBrowserProfiles(): { browser: string; displayName: string; profileName: string; sourcePath: string }[] {
    const home = homedir();
    const profiles: { browser: string; displayName: string; profileName: string; sourcePath: string }[] = [];

    if (this.osType === "macos") {
      const appSupport = join(home, "Library", "Application Support");

      // Arc
      const arcPath = join(appSupport, "Arc", "StorableSidebar.json");
      if (existsSync(arcPath)) {
        profiles.push({ browser: "arc", displayName: "Arc Browser", profileName: "Default", sourcePath: arcPath });
      }

      // Chrome
      const chromeUserData = join(appSupport, "Google", "Chrome");
      if (existsSync(chromeUserData)) {
        const entries = readdirSync(chromeUserData, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && (entry.name === "Default" || entry.name.startsWith("Profile "))) {
            const prefPath = join(chromeUserData, entry.name, "Preferences");
            if (existsSync(prefPath)) {
              profiles.push({ browser: "chrome", displayName: "Google Chrome", profileName: entry.name, sourcePath: prefPath });
            }
          }
        }
      }

      // Vivaldi
      const vivaldiUserData = join(appSupport, "Vivaldi", "Default");
      const vivaldiPref = join(vivaldiUserData, "Preferences");
      if (existsSync(vivaldiPref)) {
        profiles.push({ browser: "vivaldi", displayName: "Vivaldi", profileName: "Default", sourcePath: vivaldiPref });
      }

      // Zen Browser
      const zenProfilesDir = join(appSupport, "zen", "Profiles");
      if (existsSync(zenProfilesDir)) {
        const entries = readdirSync(zenProfilesDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const sessionPath = join(zenProfilesDir, entry.name, "sessionstore.jsonlz4");
            if (existsSync(sessionPath)) {
              profiles.push({ browser: "zen", displayName: "Zen Browser", profileName: entry.name, sourcePath: sessionPath });
            }
          }
        }
      }
    }

    return profiles;
  }

  public runSync(): SyncResult {
    const timestamp = new Date().toISOString();
    const profiles = this.getBrowserProfiles();
    const allNodes: BrowserTreeNode[] = [];
    const errors: { browser: string; message: string }[] = [];

    for (const prof of profiles) {
      try {
        const safeTmpFile = join(this.cacheDir, `${prof.browser}_${prof.profileName.replace(/\s+/g, "_")}_${Date.now()}`);
        copyFileSync(prof.sourcePath, safeTmpFile);

        let nodes: BrowserTreeNode[] = [];
        if (prof.browser === "arc") {
          nodes = parseArcSidebar({
            filePath: safeTmpFile,
            osType: this.osType,
            profileName: prof.profileName,
            snapshotTime: timestamp,
          });
        } else if (prof.browser === "chrome") {
          nodes = parseChromePreferences({
            filePath: safeTmpFile,
            osType: this.osType,
            profileName: prof.profileName,
            snapshotTime: timestamp,
          });
        } else if (prof.browser === "vivaldi") {
          nodes = parseVivaldiPreferences({
            filePath: safeTmpFile,
            osType: this.osType,
            profileName: prof.profileName,
            snapshotTime: timestamp,
          });
        } else if (prof.browser === "zen") {
          nodes = parseZenSessionstore({
            filePath: safeTmpFile,
            osType: this.osType,
            profileName: prof.profileName,
            snapshotTime: timestamp,
          });
        }

        if (nodes.length > 0) {
          allNodes.push(...nodes);
        }
      } catch (err: any) {
        errors.push({ browser: prof.browser, message: err?.message || String(err) });
      }
    }

    if (allNodes.length > 0) {
      this.db.upsertNodes(allNodes);
    }

    return {
      success: errors.length === 0,
      syncedNodesCount: allNodes.length,
      timestamp,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  public getStatsWithDetected(): SyncStats {
    const baseStats = this.db.getStats();
    const profiles = this.getBrowserProfiles();

    const browsers = [
      { name: "chrome", displayName: "Google Chrome" },
      { name: "arc", displayName: "Arc Browser" },
      { name: "vivaldi", displayName: "Vivaldi" },
      { name: "zen", displayName: "Zen Browser" },
    ];

    baseStats.detectedBrowsers = browsers.map((b) => {
      const matched = profiles.filter((p) => p.browser === b.name);
      return {
        name: b.name,
        displayName: b.displayName,
        detected: matched.length > 0,
        profileCount: matched.length,
      };
    });

    return baseStats;
  }
}
