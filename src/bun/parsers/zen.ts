import { existsSync, readFileSync } from "node:fs";
import lz4js from "lz4js";
import type { BrowserTreeNode, OSType } from "../../shared/types";

export interface ZenParserOptions {
  filePath: string;
  osType: OSType;
  profileName: string;
  snapshotTime: string;
}

export function parseZenSessionstore(options: ZenParserOptions): BrowserTreeNode[] {
  const { filePath, osType, profileName, snapshotTime } = options;
  if (!existsSync(filePath)) return [];

  const buffer = readFileSync(filePath);
  let jsonString = "";

  // Mozilla jsonlz4 starts with 'mozLz40\0' (8 bytes), followed by 4-byte uncompressed size
  const MOZ_MAGIC = "mozLz40\0";
  if (buffer.length >= 12 && buffer.subarray(0, 8).toString("utf-8") === MOZ_MAGIC) {
    const uncompressedSize = buffer.readUInt32LE(8);
    const compressed = buffer.subarray(12);
    const uncompressed = new Uint8Array(uncompressedSize);
    lz4js.decompressBlock(compressed, uncompressed, 0, compressed.length, 0);
    jsonString = new TextDecoder().decode(uncompressed);
  } else {
    jsonString = buffer.toString("utf-8");
  }

  return parseZenSessionData(JSON.parse(jsonString), options);
}

export function parseZenSessionData(data: any, options: Omit<ZenParserOptions, "filePath">): BrowserTreeNode[] {
  const { osType, profileName, snapshotTime } = options;
  const nodes: BrowserTreeNode[] = [];
  // Zen profile names contain spaces and punctuation. Keep every imported node
  // scoped to its profile so separate Zen profiles cannot overwrite each other.
  const profileId = encodeURIComponent(profileName);

  const rootId = `zen-${osType}-${profileId}-root`;
  nodes.push({
    id: rootId,
    browser_name: "zen",
    os_type: osType,
    profile_name: profileName,
    node_type: "root",
    title: `Zen Browser (${profileName})`,
    url: null,
    parent_id: null,
    sort_order: 0,
    snapshot_time: snapshotTime,
  });

  const windows = data.windows || [];
  windows.forEach((win: any, winIdx: number) => {
    const windowId = `zen-${profileId}-win-${winIdx}`;
    nodes.push({
      id: windowId,
      browser_name: "zen",
      os_type: osType,
      profile_name: profileName,
      node_type: "window",
      title: `Window ${winIdx + 1}`,
      url: null,
      parent_id: rootId,
      sort_order: winIdx,
      snapshot_time: snapshotTime,
    });

    const workspaceIds = new Map<string, string>();
    const spaces = Array.isArray(win.spaces) ? win.spaces : [];
    spaces.forEach((space: any, spaceIdx: number) => {
      const sourceId = String(space?.uuid || `default-${spaceIdx}`);
      const workspaceId = `zen-${profileId}-win-${winIdx}-ws-${encodeURIComponent(sourceId)}`;
      workspaceIds.set(sourceId, workspaceId);
      nodes.push({
        id: workspaceId,
        browser_name: "zen",
        os_type: osType,
        profile_name: profileName,
        node_type: "workspace",
        title: space?.name || `Workspace ${spaceIdx + 1}`,
        url: null,
        parent_id: windowId,
        sort_order: spaceIdx,
        snapshot_time: snapshotTime,
      });
    });

    const defaultWorkspaceId = `zen-${profileId}-win-${winIdx}-ws-default`;
    const getWorkspaceId = (sourceId: unknown) => {
      const id = sourceId == null ? undefined : workspaceIds.get(String(sourceId));
      if (id) return id;
      if (!workspaceIds.has("__default__")) {
        workspaceIds.set("__default__", defaultWorkspaceId);
        nodes.push({
          id: defaultWorkspaceId,
          browser_name: "zen",
          os_type: osType,
          profile_name: profileName,
          node_type: "workspace",
          title: "Main Workspace",
          url: null,
          parent_id: windowId,
          sort_order: spaces.length,
          snapshot_time: snapshotTime,
        });
      }
      return defaultWorkspaceId;
    };

    const folderIds = new Map<string, string>();
    const folders = Array.isArray(win.folders) ? win.folders : [];
    const tabs = Array.isArray(win.tabs) ? win.tabs : [];
    // Zen represents each folder in its tab sequence with an internal empty
    // group-anchor tab. Its position is the folder's sidebar position.
    const folderSortOrders = new Map<string, number>();
    tabs.forEach((tab: any, tabIdx: number) => {
      if (tab?.zenIsEmpty && tab.groupId != null) {
        folderSortOrders.set(String(tab.groupId), tabIdx);
      }
    });
    folders.forEach((folder: any, folderIdx: number) => {
      if (folder?.id != null) {
        folderIds.set(String(folder.id), `zen-${profileId}-win-${winIdx}-folder-${encodeURIComponent(String(folder.id))}`);
      }
    });
    folders.forEach((folder: any, folderIdx: number) => {
      const folderId = folderIds.get(String(folder?.id));
      if (!folderId) return;
      const parentId = folder?.parentId != null
        ? folderIds.get(String(folder.parentId)) || getWorkspaceId(folder.workspaceId)
        : getWorkspaceId(folder.workspaceId);
      nodes.push({
        id: folderId,
        browser_name: "zen",
        os_type: osType,
        profile_name: profileName,
        node_type: "folder",
        title: folder?.name || "Folder",
        url: null,
        parent_id: parentId,
        sort_order: folderSortOrders.get(String(folder.id)) ?? folderIdx,
        snapshot_time: snapshotTime,
      });
    });

    tabs.forEach((tab: any, tabIdx: number) => {
      // Zen creates an empty about:blank tab as each folder's internal group
      // anchor. It is not displayed as a user tab and must not leak into SyncTable.
      if (tab.zenIsEmpty) return;
      const activeEntryIdx = (tab.index || 1) - 1;
      const entry = tab.entries?.[activeEntryIdx] || tab.entries?.[tab.entries.length - 1];
      const url = entry?.url || null;
      const title = tab.zenStaticLabel?.trim() || entry?.title || tab.title || url || `Tab ${tabIdx + 1}`;
      const isPinned = Boolean(tab.pinned);
      const folderId = tab.groupId != null ? folderIds.get(String(tab.groupId)) : undefined;

      nodes.push({
        id: `zen-${profileId}-win-${winIdx}-tab-${tabIdx}`,
        browser_name: "zen",
        os_type: osType,
        profile_name: profileName,
        node_type: isPinned ? "pinned_tab" : "tab",
        title,
        url,
        parent_id: folderId || getWorkspaceId(tab.zenWorkspace),
        sort_order: tabIdx,
        snapshot_time: snapshotTime,
      });
    });
  });

  return nodes;
}
