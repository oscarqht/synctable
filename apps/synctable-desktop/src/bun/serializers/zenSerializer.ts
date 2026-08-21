import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import lz4js from "lz4js";
import { extractWorkspacesFromRoot, isValidHttpUrl, type BrowserTreeNode } from "@synctable/ui";

export interface ZenSerializerOptions {
  profilePath: string;
  mode?: "merge" | "overwrite";
}

const MOZ_MAGIC = "mozLz40\0";

export function compressMozLz4(jsonStr: string): Buffer {
  const uncompressed = new TextEncoder().encode(jsonStr);
  const hashTable = new Uint32Array(65536);
  const maxCompressedSize = lz4js.compressBound(uncompressed.length);
  const compressedBlock = new Uint8Array(maxCompressedSize);
  const compressedSize = lz4js.compressBlock(uncompressed, compressedBlock, 0, uncompressed.length, hashTable);

  const finalBuf = Buffer.alloc(12 + compressedSize);
  finalBuf.write(MOZ_MAGIC, 0, 8, "utf-8");
  finalBuf.writeUInt32LE(uncompressed.length, 8);
  finalBuf.set(compressedBlock.subarray(0, compressedSize), 12);
  return finalBuf;
}

export function decompressMozLz4(buffer: Buffer): any {
  if (buffer.length >= 12 && buffer.subarray(0, 8).toString("utf-8") === MOZ_MAGIC) {
    const uncompressedSize = buffer.readUInt32LE(8);
    const compressed = buffer.subarray(12);
    const uncompressed = new Uint8Array(uncompressedSize);
    lz4js.decompressBlock(compressed, uncompressed, 0, compressed.length, 0);
    const jsonStr = new TextDecoder().decode(uncompressed);
    return JSON.parse(jsonStr);
  }
  return JSON.parse(buffer.toString("utf-8"));
}

export function serializeToZenSession(
  nodes: BrowserTreeNode[],
  options: ZenSerializerOptions
): { success: boolean; spacesCount: number; tabsCount: number; error?: string } {
  try {
    const { profilePath, mode = "merge" } = options;

    const recoveryPath = join(profilePath, "sessionstore-backups", "recovery.jsonlz4");
    const sessionPath = join(profilePath, "sessionstore.jsonlz4");

    let existingData: any = null;
    const sourcePath = existsSync(recoveryPath) ? recoveryPath : existsSync(sessionPath) ? sessionPath : null;

    if (sourcePath && mode === "merge") {
      try {
        const raw = readFileSync(sourcePath);
        existingData = decompressMozLz4(raw);
      } catch (err) {
        console.warn("[ZenSerializer] Failed to decompress existing session, initializing new:", err);
      }
    }

    if (!existingData || typeof existingData !== "object") {
      existingData = {
        version: ["sessionrestore", 1],
        windows: [{ tabs: [], spaces: [], folders: [], selected: 1 }],
      };
    }

    if (!Array.isArray(existingData.windows) || existingData.windows.length === 0) {
      existingData.windows = [{ tabs: [], spaces: [], folders: [], selected: 1 }];
    }

    const win0 = existingData.windows[0];
    if (!Array.isArray(win0.tabs)) win0.tabs = [];
    if (!Array.isArray(win0.spaces)) win0.spaces = [];
    if (!Array.isArray(win0.folders)) win0.folders = [];

    if (mode === "overwrite") {
      win0.tabs = [];
      win0.spaces = [];
      win0.folders = [];
    }

    const workspaces = nodes.flatMap(extractWorkspacesFromRoot);
    if (workspaces.length === 0 && nodes.length > 0) {
      workspaces.push({
        id: randomUUID(),
        browserName: "imported",
        browserTitle: "Imported Workspace",
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
                  entries: [{ url: child.url, title: child.title || child.url }],
                  index: 1,
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
            entries: [{ url: node.url, title: node.title || node.url }],
            index: 1,
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

    const compressed = compressMozLz4(JSON.stringify(existingData));

    // Ensure backups dir exists
    const backupsDir = join(profilePath, "sessionstore-backups");
    mkdirSync(backupsDir, { recursive: true });

    writeFileSync(recoveryPath, compressed);
    writeFileSync(sessionPath, compressed);

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
