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

  const data = JSON.parse(jsonString);
  const nodes: BrowserTreeNode[] = [];

  const rootId = `zen-${osType}-${profileName}-root`;
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
    const windowId = `zen-win-${winIdx}`;
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

    const workspaceId = `zen-ws-default-${winIdx}`;
    nodes.push({
      id: workspaceId,
      browser_name: "zen",
      os_type: osType,
      profile_name: profileName,
      node_type: "workspace",
      title: "Main Workspace",
      url: null,
      parent_id: windowId,
      sort_order: 0,
      snapshot_time: snapshotTime,
    });

    const tabs = win.tabs || [];
    tabs.forEach((tab: any, tabIdx: number) => {
      const activeEntryIdx = (tab.index || 1) - 1;
      const entry = tab.entries?.[activeEntryIdx] || tab.entries?.[tab.entries.length - 1];
      const url = entry?.url || null;
      const title = entry?.title || tab.title || url || `Tab ${tabIdx + 1}`;
      const isPinned = Boolean(tab.pinned);

      nodes.push({
        id: `zen-tab-${winIdx}-${tabIdx}`,
        browser_name: "zen",
        os_type: osType,
        profile_name: profileName,
        node_type: isPinned ? "pinned_tab" : "tab",
        title,
        url,
        parent_id: workspaceId,
        sort_order: tabIdx,
        snapshot_time: snapshotTime,
      });
    });
  });

  return nodes;
}
