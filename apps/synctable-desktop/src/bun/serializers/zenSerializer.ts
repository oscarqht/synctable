import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import lz4js from "lz4js";
import { extractWorkspacesFromRoot, isValidHttpUrl, type BrowserTreeNode } from "@synctable/ui";

export interface ZenSerializerOptions {
  profilePath: string;
  mode?: "merge" | "overwrite";
}

const MOZ_LZ4_MAGIC = "mozLz40\0"; // 8 bytes: 6d 6f 7a 4c 7a 34 30 00

export function decompressMozLz4(buffer: Buffer): any {
  const magic = buffer.subarray(0, 8).toString("binary");
  if (magic !== MOZ_LZ4_MAGIC) {
    throw new Error("Invalid Mozilla LZ4 header magic");
  }

  const uncompressedSize = buffer.readUInt32LE(8);
  const compressedData = buffer.subarray(12);

  const decompressed = new Uint8Array(uncompressedSize);
  lz4js.decompressBlock(compressedData, decompressed, 0, compressedData.length, 0);

  const jsonStr = new TextDecoder().decode(decompressed);
  return JSON.parse(jsonStr);
}

export function compressMozLz4(jsonString: string): Buffer {
  const uncompressedBytes = new TextEncoder().encode(jsonString);
  const uncompressedSize = uncompressedBytes.length;

  const maxCompressedSize = lz4js.compressBound(uncompressedSize);
  const compressedBlock = new Uint8Array(maxCompressedSize);
  const sTable = new Uint32Array(65536);

  const compressedLen = lz4js.compressBlock(
    uncompressedBytes,
    compressedBlock,
    0,
    uncompressedSize,
    sTable
  );

  const outBuf = Buffer.alloc(8 + 4 + compressedLen);
  outBuf.write(MOZ_LZ4_MAGIC, 0, 8, "binary");
  outBuf.writeUInt32LE(uncompressedSize, 8);
  outBuf.set(compressedBlock.subarray(0, compressedLen), 12);

  return outBuf;
}

export function serializeToZenSession(
  nodes: BrowserTreeNode[],
  options: ZenSerializerOptions
): {
  success: boolean;
  spacesCount: number;
  tabsCount: number;
  error?: string;
} {
  try {
    const { profilePath, mode = "merge" } = options;

    if (!existsSync(profilePath)) {
      mkdirSync(profilePath, { recursive: true });
    }

    const recoveryPath = join(profilePath, "sessionstore-backups", "recovery.jsonlz4");
    const sessionPath = join(profilePath, "sessionstore.jsonlz4");

    let existingData: any = null;
    if (mode === "merge") {
      const pathToRead = existsSync(recoveryPath) ? recoveryPath : existsSync(sessionPath) ? sessionPath : null;
      if (pathToRead) {
        try {
          const rawBuf = readFileSync(pathToRead);
          existingData = decompressMozLz4(rawBuf);
        } catch {
          existingData = null;
        }
      }
    }

    const now = Date.now();

    if (!existingData || !existingData.windows || !Array.isArray(existingData.windows) || existingData.windows.length === 0) {
      existingData = {
        version: ["sessionrestore", 1],
        windows: [
          {
            tabs: [],
            selected: 1,
            _closedTabs: [],
            busy: false,
            zIndex: 1,
            width: 1400,
            height: 900,
            screenX: 100,
            screenY: 100,
            sizemode: "normal",
            spaces: [],
            folders: [],
            activeZenSpace: null,
          },
        ],
        _closedWindows: [],
        selectedWindow: 1,
        session: {
          lastUpdate: now,
          startTime: now - 10000,
          recentCrashes: 0,
        },
        global: {},
        cookies: [],
        savedGroups: [],
        maxSplitViewId: 0,
      };
    }

    const win0 = existingData.windows[0];
    win0.spaces = win0.spaces || [];
    win0.folders = win0.folders || [];

    if (mode === "merge") {
      // Filter out about:home / about:blank / about:newtab so they don't hide restored tabs
      win0.tabs = (win0.tabs || []).filter((t: any) => {
        const url = t?.entries?.[t.entries.length - 1]?.url;
        return url && !url.startsWith("about:") && isValidHttpUrl(url);
      });
    } else {
      win0.tabs = [];
      win0.spaces = [];
      win0.folders = [];
    }

    win0.selected = 1;
    win0._closedTabs = [];
    win0.busy = false;

    const workspaces = nodes.flatMap(extractWorkspacesFromRoot);
    if (workspaces.length === 0 && nodes.length > 0) {
      workspaces.push({
        id: randomUUID(),
        browserName: "zen",
        browserTitle: "Zen Browser",
        profileName: "Default",
        workspaceTitle: "Restored Workspace",
        node: {
          id: randomUUID(),
          browser_name: "zen",
          os_type: "macos",
          profile_name: "Default",
          node_type: "workspace",
          title: "Restored Workspace",
          url: null,
          parent_id: null,
          sort_order: 0,
          snapshot_time: new Date().toISOString(),
          children: nodes,
        },
        tabCount: nodes.length,
      });
    }

    let totalTabs = 0;

    for (const ws of workspaces) {
      const spaceUUID = randomUUID();
      const themeColors = ws.themeColors || (ws.themeColor ? [ws.themeColor] : []);

      win0.spaces.push({
        uuid: spaceUUID,
        name: ws.workspaceTitle || "Restored Workspace",
        icon: ws.icon || null,
        theme: themeColors.length > 0
          ? {
              color: themeColors[0],
              colors: themeColors,
              gradientColors: themeColors.map((c, i) => ({ color: c, isPrimary: i === 0 })),
            }
          : null,
      });

      function processNode(node: BrowserTreeNode, parentFolderId?: string) {
        if (!node) return;

        if (node.node_type === "folder") {
          const folderId = randomUUID();
          win0.folders.push({
            id: folderId,
            name: node.title || "Folder",
            workspaceId: spaceUUID,
            parentId: parentFolderId || null,
            splitViewGroup: false,
          });

          if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
              processNode(child, folderId);
            }
          }
          return;
        }

        if (node.node_type === "split_view") {
          const splitId = randomUUID();
          win0.folders.push({
            id: splitId,
            name: node.title || "Split View",
            workspaceId: spaceUUID,
            parentId: parentFolderId || null,
            splitViewGroup: true,
          });

          if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
              if (isValidHttpUrl(child.url)) {
                totalTabs++;
                win0.tabs.push({
                  entries: [
                    {
                      url: child.url,
                      title: child.title || child.url,
                      triggeringPrincipal_base64: '{"3":{}}',
                      docshellUUID: `{${randomUUID()}}`,
                      transient: false,
                    },
                  ],
                  lastAccessed: now,
                  hidden: false,
                  userContextId: 0,
                  index: 1,
                  image: null,
                  pinned: false,
                  zenWorkspace: spaceUUID,
                  groupId: splitId,
                  zenIsEmpty: false,
                  zenStaticLabel: child.title || child.url,
                });
              }
            }
          }
          return;
        }

        if ((node.node_type === "tab" || node.node_type === "pinned_tab") && isValidHttpUrl(node.url)) {
          totalTabs++;
          win0.tabs.push({
            entries: [
              {
                url: node.url,
                title: node.title || node.url,
                triggeringPrincipal_base64: '{"3":{}}',
                docshellUUID: `{${randomUUID()}}`,
                transient: false,
              },
            ],
            lastAccessed: now,
            hidden: false,
            userContextId: 0,
            index: 1,
            image: null,
            pinned: node.node_type === "pinned_tab",
            zenWorkspace: spaceUUID,
            groupId: parentFolderId || null,
            zenIsEmpty: false,
            zenStaticLabel: node.title || node.url,
          });
        }
      }

      const wsChildren = ws.node.children || [];
      for (const child of wsChildren) {
        processNode(child);
      }
    }

    if (win0.spaces.length > 0 && !win0.activeZenSpace) {
      win0.activeZenSpace = win0.spaces[0].uuid;
    }

    // Update global session timestamps
    existingData.session = existingData.session || {};
    existingData.session.lastUpdate = now;
    existingData.session.startTime = now - 10000;
    existingData.session.recentCrashes = 0;

    const compressed = compressMozLz4(JSON.stringify(existingData));

    // Ensure backups dir exists
    const backupsDir = join(profilePath, "sessionstore-backups");
    mkdirSync(backupsDir, { recursive: true });

    // Write to all session restore locations that Firefox & Zen look for
    writeFileSync(sessionPath, compressed);
    writeFileSync(recoveryPath, compressed);
    writeFileSync(join(backupsDir, "recovery.baklz4"), compressed);
    writeFileSync(join(backupsDir, "previous.jsonlz4"), compressed);

    // Write sessionCheckpoints.json so Firefox knows clean shutdown occurred with session written
    const checkpointsPath = join(profilePath, "sessionCheckpoints.json");
    const checkpoints = {
      "profile-after-change": true,
      "final-ui-startup": true,
      "sessionstore-windows-restored": true,
      "quit-application-granted": true,
      "quit-application": true,
      "sessionstore-final-state-write-complete": true,
      "profile-change-net-teardown": true,
      "profile-change-teardown": true,
      "profile-before-change": true,
    };
    writeFileSync(checkpointsPath, JSON.stringify(checkpoints), "utf8");

    // Update or append user.js to ensure Firefox/Zen automatically restores the session on startup
    const userJsPath = join(profilePath, "user.js");
    let userJsContent = "";
    if (existsSync(userJsPath)) {
      try {
        userJsContent = readFileSync(userJsPath, "utf8");
      } catch {
        userJsContent = "";
      }
    }

    const startupPrefs = `
// SyncTable session restore configuration
user_pref("browser.startup.page", 3);
user_pref("browser.sessionstore.resume_from_crash", true);
user_pref("browser.sessionstore.restore_on_demand", false);
`;

    if (!userJsContent.includes("browser.startup.page")) {
      writeFileSync(userJsPath, userJsContent + "\n" + startupPrefs, "utf8");
    }

    return {
      success: true,
      spacesCount: workspaces.length,
      tabsCount: totalTabs,
    };
  } catch (err: any) {
    return {
      success: false,
      spacesCount: 0,
      tabsCount: 0,
      error: err?.message || String(err),
    };
  }
}
