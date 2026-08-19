import { existsSync, readFileSync } from "node:fs";
import type { BrowserTreeNode, OSType } from "../../shared/types";

export interface ChromeParserOptions {
  filePath: string;
  osType: OSType;
  profileName: string;
  snapshotTime: string;
}

export function parseChromePreferences(options: ChromeParserOptions): BrowserTreeNode[] {
  const { filePath, osType, profileName, snapshotTime } = options;
  if (!existsSync(filePath)) return [];

  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  const nodes: BrowserTreeNode[] = [];

  const rootId = `chrome-${osType}-${profileName}-root`;
  nodes.push({
    id: rootId,
    browser_name: "chrome",
    os_type: osType,
    profile_name: profileName,
    node_type: "root",
    title: `Chrome (${profileName})`,
    url: null,
    parent_id: null,
    sort_order: 0,
    snapshot_time: snapshotTime,
  });

  const windowId = `chrome-${profileName}-win-default`;
  nodes.push({
    id: windowId,
    browser_name: "chrome",
    os_type: osType,
    profile_name: profileName,
    node_type: "window",
    title: "Default Window",
    url: null,
    parent_id: rootId,
    sort_order: 0,
    snapshot_time: snapshotTime,
  });

  const workspaceId = `chrome-${profileName}-ws-default`;
  nodes.push({
    id: workspaceId,
    browser_name: "chrome",
    os_type: osType,
    profile_name: profileName,
    node_type: "workspace",
    title: "Default Workspace",
    url: null,
    parent_id: windowId,
    sort_order: 0,
    snapshot_time: snapshotTime,
  });

  // Extract Tab Groups
  const tabGroups = data?.tab_groups || {};
  let groupIndex = 0;
  for (const [groupId, groupData] of Object.entries<any>(tabGroups)) {
    const folderId = `chrome-group-${groupId}`;
    nodes.push({
      id: folderId,
      browser_name: "chrome",
      os_type: osType,
      profile_name: profileName,
      node_type: "folder",
      title: groupData?.title || `Group ${groupIndex + 1}`,
      url: null,
      parent_id: workspaceId,
      sort_order: groupIndex++,
      snapshot_time: snapshotTime,
    });
  }

  return nodes;
}
