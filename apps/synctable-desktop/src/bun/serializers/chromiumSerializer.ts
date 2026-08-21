import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { extractWorkspacesFromRoot, isValidHttpUrl, type BrowserTreeNode } from "@synctable/ui";

export interface ChromiumSerializerOptions {
  profilePath: string;
  browserName?: "chrome" | "vivaldi" | "brave" | "edge" | string;
  mode?: "merge" | "overwrite";
}

function writePickleString(str: string): Buffer {
  const buf = Buffer.from(str, "utf8");
  const pad = (4 - (buf.length % 4)) % 4;
  const out = Buffer.alloc(4 + buf.length + pad);
  out.writeInt32LE(buf.length, 0);
  buf.copy(out, 4);
  return out;
}

function writePickleString16(str: string): Buffer {
  const buf = Buffer.from(str, "utf16le");
  const pad = (4 - (buf.length % 4)) % 4;
  const out = Buffer.alloc(4 + buf.length + pad);
  out.writeInt32LE(str.length, 0); // char count
  buf.copy(out, 4);
  return out;
}

function buildCommand(cmdId: number, payload: Buffer): Buffer {
  const out = Buffer.alloc(2 + 1 + payload.length);
  out.writeUInt16LE(payload.length + 1, 0);
  out[2] = cmdId;
  payload.copy(out, 3);
  return out;
}

interface FlattenedChromiumTab {
  tabId: number;
  windowId: number;
  visualIndex: number;
  url: string;
  title: string;
  pinned: boolean;
  groupId?: string;
  groupTitle?: string;
  groupHigh?: bigint;
  groupLow?: bigint;
  splitId?: string;
  splitIndex?: number;
  splitHigh?: bigint;
  splitLow?: bigint;
  workspaceId?: string;
  workspaceTitle?: string;
}

export function serializeToChromiumSession(
  nodes: BrowserTreeNode[],
  options: ChromiumSerializerOptions
): {
  success: boolean;
  spacesCount: number;
  tabsCount: number;
  error?: string;
} {
  try {
    const { profilePath, mode = "merge" } = options;
    const browser = (options.browserName || "chrome").toLowerCase();
    const isVivaldi = browser === "vivaldi";

    if (!existsSync(profilePath)) {
      mkdirSync(profilePath, { recursive: true });
    }

    const sessionsDir = join(profilePath, "Sessions");
    if (!existsSync(sessionsDir)) {
      mkdirSync(sessionsDir, { recursive: true });
    }

    const workspaces = nodes.flatMap(extractWorkspacesFromRoot);
    if (workspaces.length === 0) {
      return { success: false, spacesCount: 0, tabsCount: 0, error: "No workspaces found to restore" };
    }

    const flatTabs: FlattenedChromiumTab[] = [];
    const tabGroupsMap = new Map<string, { id: string; title: string; high: bigint; low: bigint }>();
    const vivaldiWorkspacesList: { id: string; name: string }[] = [];

    let currentTabIdCounter = 1000 + Math.floor(Math.random() * 5000);
    let groupTokenCounter = 1n;
    let splitTokenCounter = 100n;

    workspaces.forEach((ws, wsIdx) => {
      const wsId = ws.id || `ws-${wsIdx + 1}`;
      const wsTitle = ws.workspaceTitle || `Workspace ${wsIdx + 1}`;
      vivaldiWorkspacesList.push({ id: wsId, name: wsTitle });

      const wsNode = ws.node;
      if (!wsNode || !wsNode.children) return;

      const windowId = wsIdx + 1;
      let visualIndex = 0;

      const processItem = (item: BrowserTreeNode, parentGroup?: { id: string; title: string; high: bigint; low: bigint }) => {
        if (item.node_type === "folder") {
          const groupId = item.id || `group-${randomUUID()}`;
          const groupTitle = item.title || "Tab Group";
          const high = groupTokenCounter++;
          const low = BigInt(Math.floor(Math.random() * 1000000) + 1);
          const groupInfo = { id: groupId, title: groupTitle, high, low };
          tabGroupsMap.set(groupId, groupInfo);

          if (item.children) {
            for (const child of item.children) {
              processItem(child, groupInfo);
            }
          }
          return;
        }

        if (item.node_type === "split_view") {
          const splitId = item.id || `split-${randomUUID()}`;
          const splitHigh = splitTokenCounter++;
          const splitLow = BigInt(Math.floor(Math.random() * 1000000) + 1);

          if (item.children) {
            item.children.forEach((child, splitIndex) => {
              if (child.url && isValidHttpUrl(child.url)) {
                flatTabs.push({
                  tabId: ++currentTabIdCounter,
                  windowId,
                  visualIndex: visualIndex++,
                  url: child.url,
                  title: child.title || "Split Tab",
                  pinned: child.node_type === "pinned_tab",
                  groupId: parentGroup?.id,
                  groupTitle: parentGroup?.title,
                  groupHigh: parentGroup?.high,
                  groupLow: parentGroup?.low,
                  splitId,
                  splitIndex,
                  splitHigh,
                  splitLow,
                  workspaceId: wsId,
                  workspaceTitle: wsTitle,
                });
              }
            });
          }
          return;
        }

        if ((item.node_type === "tab" || item.node_type === "pinned_tab") && item.url && isValidHttpUrl(item.url)) {
          flatTabs.push({
            tabId: ++currentTabIdCounter,
            windowId,
            visualIndex: visualIndex++,
            url: item.url,
            title: item.title || "Tab",
            pinned: item.node_type === "pinned_tab",
            groupId: parentGroup?.id,
            groupTitle: parentGroup?.title,
            groupHigh: parentGroup?.high,
            groupLow: parentGroup?.low,
            workspaceId: wsId,
            workspaceTitle: wsTitle,
          });
        }
      };

      for (const item of wsNode.children) {
        processItem(item);
      }
    });

    if (flatTabs.length === 0) {
      return { success: false, spacesCount: workspaces.length, tabsCount: 0, error: "No valid HTTP tabs found to restore" };
    }

    // Build SNSS Binary Commands
    const commands: Buffer[] = [];

    // Header: Magic "SNSS", Version 3
    const header = Buffer.alloc(8);
    header.write("SNSS", 0, "ascii");
    header.writeUInt32LE(3, 4);
    commands.push(header);

    // Group Metadata Commands (Command 27)
    for (const group of tabGroupsMap.values()) {
      const titlePickle = isVivaldi ? writePickleString(group.title) : writePickleString16(group.title);
      const c27 = Buffer.concat([Buffer.alloc(20), titlePickle]);
      c27.writeBigUInt64LE(group.high, 4);
      c27.writeBigUInt64LE(group.low, 12);
      commands.push(buildCommand(27, c27));
    }

    // Tab Commands
    for (const tab of flatTabs) {
      // 1. Command 0: SetTabWindow (windowId, tabId)
      const c0 = Buffer.alloc(8);
      c0.writeInt32LE(tab.windowId, 0);
      c0.writeInt32LE(tab.tabId, 4);
      commands.push(buildCommand(0, c0));

      // 2. Command 2: SetTabIndexInWindow (tabId, visualIndex)
      const c2 = Buffer.alloc(8);
      c2.writeInt32LE(tab.tabId, 0);
      c2.writeInt32LE(tab.visualIndex, 4);
      commands.push(buildCommand(2, c2));

      // 3. Command 12: SetPinnedState (if pinned)
      if (tab.pinned) {
        const c12 = Buffer.alloc(5);
        c12.writeInt32LE(tab.tabId, 0);
        c12[4] = 1;
        commands.push(buildCommand(12, c12));
      }

      // 4. Command 25: SetTabGroup (if part of group)
      if (tab.groupId && tab.groupHigh !== undefined && tab.groupLow !== undefined) {
        const c25 = Buffer.alloc(21);
        c25.writeInt32LE(tab.tabId, 0);
        c25.writeBigUInt64LE(tab.groupHigh, 4);
        c25.writeBigUInt64LE(tab.groupLow, 12);
        c25[20] = 1;
        commands.push(buildCommand(25, c25));
      }

      // 5. Command 36: SetSplitTab (if part of split view)
      if (tab.splitId && tab.splitHigh !== undefined && tab.splitLow !== undefined) {
        const c36 = Buffer.alloc(25);
        c36.writeInt32LE(tab.tabId, 0);
        c36.writeBigUInt64LE(tab.splitHigh, 8);
        c36.writeBigUInt64LE(tab.splitLow, 16);
        c36[24] = 1; // has_split
        commands.push(buildCommand(36, c36));
      }

      // 6. Command 6: UpdateTabNavigation (url, title)
      const urlPickle = writePickleString(tab.url);
      const titlePickle = writePickleString16(tab.title);
      const c6 = Buffer.concat([
        Buffer.alloc(12),
        urlPickle,
        titlePickle,
      ]);
      c6.writeInt32LE(c6.length, 0);
      c6.writeInt32LE(tab.tabId, 4);
      c6.writeInt32LE(0, 8); // nav index 0
      commands.push(buildCommand(6, c6));

      // 7. Command 21: Vivaldi SetTabData
      if (isVivaldi) {
        const vivaldiData = {
          fixedTitle: tab.title,
          group: tab.groupId,
          fixedGroupTitle: tab.groupTitle,
          workspaceId: tab.workspaceId,
          tiling: tab.splitId ? { id: tab.splitId, index: tab.splitIndex ?? 0 } : undefined,
        };
        const c21 = Buffer.concat([Buffer.alloc(8), writePickleString(JSON.stringify(vivaldiData))]);
        c21.writeInt32LE(0, 0);
        c21.writeInt32LE(tab.tabId, 4);
        commands.push(buildCommand(21, c21));
      }
    }

    const sessionBuffer = Buffer.concat(commands);

    // Remove old Session_* and Tabs_* files in overwrite mode or to force current restore
    const existingSessionFiles = readdirSync(sessionsDir).filter(
      (n) => n.startsWith("Session_") || n.startsWith("Tabs_")
    );
    for (const f of existingSessionFiles) {
      try {
        rmSync(join(sessionsDir, f), { force: true });
      } catch {
        // ignore
      }
    }

    // Write new timestamped Session_* and Tabs_*
    const timestamp = Date.now() * 10000;
    const sessionFilePath = join(sessionsDir, `Session_${timestamp}`);
    const tabsFilePath = join(sessionsDir, `Tabs_${timestamp}`);

    writeFileSync(sessionFilePath, sessionBuffer);
    writeFileSync(tabsFilePath, sessionBuffer);

    // Update Preferences file
    const prefPath = join(profilePath, "Preferences");
    let preferences: any = {};
    if (existsSync(prefPath)) {
      try {
        preferences = JSON.parse(readFileSync(prefPath, "utf8"));
      } catch {
        preferences = {};
      }
    }

    preferences.session = preferences.session || {};
    preferences.session.restore_on_startup = 1;
    preferences.profile = preferences.profile || {};
    preferences.profile.exit_type = "Normal";

    // Set tab groups in Preferences
    if (tabGroupsMap.size > 0) {
      preferences.tab_groups = preferences.tab_groups || {};
      for (const [id, grp] of tabGroupsMap) {
        preferences.tab_groups[id] = {
          title: grp.title,
          color: 0,
          is_collapsed: false,
        };
      }
    }

    // Set Vivaldi workspaces list
    if (isVivaldi && vivaldiWorkspacesList.length > 0) {
      preferences.vivaldi = preferences.vivaldi || {};
      preferences.vivaldi.workspaces = preferences.vivaldi.workspaces || {};
      preferences.vivaldi.workspaces.list = vivaldiWorkspacesList;
    }

    writeFileSync(prefPath, JSON.stringify(preferences, null, 2), "utf8");

    return {
      success: true,
      spacesCount: workspaces.length,
      tabsCount: flatTabs.length,
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
