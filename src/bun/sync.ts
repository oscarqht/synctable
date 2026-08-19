import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";
import type { BrowserTreeNode, OSType, SyncResult, SyncStats } from "../shared/types";
import { parseArcSidebar, parseChromePreferences, parseDiaTree, parseVivaldiPreferences, parseZenSessionstore } from "./parsers";
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

  public getBrowserProfiles(): { browser: string; displayName: string; profileName: string; sourcePath: string; sessionPath?: string }[] {
    const home = homedir();
    const profiles: { browser: string; displayName: string; profileName: string; sourcePath: string; sessionPath?: string }[] = [];

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
      const vivaldiUserData = join(appSupport, "Vivaldi");
      if (existsSync(vivaldiUserData)) {
        for (const entry of readdirSync(vivaldiUserData, { withFileTypes: true })) {
          if (!entry.isDirectory() || (entry.name !== "Default" && !entry.name.startsWith("Profile "))) continue;
          const profileDir = join(vivaldiUserData, entry.name);
          const vivaldiPref = join(profileDir, "Preferences");
          const sessionsDir = join(profileDir, "Sessions");
          const sessionFiles = existsSync(sessionsDir)
            ? readdirSync(sessionsDir).filter((name) => name.startsWith("Session_")).map((name) => join(sessionsDir, name)).sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)
            : [];
          if (existsSync(vivaldiPref)) {
            profiles.push({ browser: "vivaldi", displayName: "Vivaldi", profileName: entry.name, sourcePath: vivaldiPref, sessionPath: sessionFiles[0] });
          }
        }
      }

      // Zen Browser
      const zenProfilesDir = join(appSupport, "zen", "Profiles");
      if (existsSync(zenProfilesDir)) {
        const entries = readdirSync(zenProfilesDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const profileDir = join(zenProfilesDir, entry.name);
            // sessionstore.jsonlz4 is only present after Zen exits. While Zen is
            // running, its current tabs, spaces, and folders are in recovery.jsonlz4.
            const recoveryPath = join(profileDir, "sessionstore-backups", "recovery.jsonlz4");
            const sessionPath = join(profileDir, "sessionstore.jsonlz4");
            const sourcePath = existsSync(recoveryPath) ? recoveryPath : sessionPath;
            if (existsSync(sourcePath)) {
              profiles.push({ browser: "zen", displayName: "Zen Browser", profileName: entry.name, sourcePath });
            }
          }
        }
      }

      // Dia stores its complete hierarchy in encrypted per-profile tabs.db
      // files. The local reader opens those databases read-only with the key
      // derived from Dia Safe Storage in macOS Keychain.
      const diaUserData = join(appSupport, "Dia", "User Data");
      if (existsSync(diaUserData)) {
        profiles.push({ browser: "dia", displayName: "Dia Browser", profileName: "Default", sourcePath: diaUserData });
      }
    }

    return profiles;
  }

  public runSync(): SyncResult {
    const timestamp = new Date().toISOString();
    const profiles = this.getBrowserProfiles();
    let syncedNodesCount = 0;
    const errors: { browser: string; message: string }[] = [];

    for (const prof of profiles) {
      try {
        if (prof.browser === "dia") {
          const nodes = parseDiaTree({
            userDataPath: prof.sourcePath,
            osType: this.osType,
            snapshotTime: timestamp,
          });
          if (nodes.length > 0) {
            // Dia's profile databases are merged into one browser-wide tree.
            // Remove legacy per-profile roots as part of every replacement.
            this.db.replaceBrowserNodes(prof.browser, nodes);
            syncedNodesCount += nodes.length;
          }
          continue;
        }

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
          const safeSessionFile = prof.sessionPath ? `${safeTmpFile}_session` : undefined;
          if (prof.sessionPath && safeSessionFile) copyFileSync(prof.sessionPath, safeSessionFile);
          nodes = parseVivaldiPreferences({
            filePath: safeTmpFile,
            sessionFilePath: safeSessionFile,
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
          this.db.replaceProfileNodes(prof.browser, prof.profileName, nodes);
          syncedNodesCount += nodes.length;
        }
      } catch (err: any) {
        errors.push({ browser: prof.browser, message: err?.message || String(err) });
      }
    }

    return {
      success: errors.length === 0,
      syncedNodesCount,
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
      { name: "dia", displayName: "Dia Browser" },
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
