import { existsSync, readFileSync } from "node:fs";
import type { BrowserTreeNode, OSType } from "../../shared/types";

export interface VivaldiParserOptions {
  filePath: string;
  osType: OSType;
  profileName: string;
  snapshotTime: string;
}

export function parseVivaldiPreferences(options: VivaldiParserOptions): BrowserTreeNode[] {
  const { filePath, osType, profileName, snapshotTime } = options;
  if (!existsSync(filePath)) return [];

  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  const nodes: BrowserTreeNode[] = [];

  const rootId = `vivaldi-${osType}-${profileName}-root`;
  nodes.push({
    id: rootId,
    browser_name: "vivaldi",
    os_type: osType,
    profile_name: profileName,
    node_type: "root",
    title: `Vivaldi (${profileName})`,
    url: null,
    parent_id: null,
    sort_order: 0,
    snapshot_time: snapshotTime,
  });

  const windowId = `vivaldi-${profileName}-win-default`;
  nodes.push({
    id: windowId,
    browser_name: "vivaldi",
    os_type: osType,
    profile_name: profileName,
    node_type: "window",
    title: "Vivaldi Window",
    url: null,
    parent_id: rootId,
    sort_order: 0,
    snapshot_time: snapshotTime,
  });

  const vivaldiSection = data?.vivaldi || {};
  const workspaces = vivaldiSection?.workspaces || [];

  if (Array.isArray(workspaces) && workspaces.length > 0) {
    workspaces.forEach((ws: any, wsIdx: number) => {
      const workspaceId = `vivaldi-ws-${ws.id || wsIdx}`;
      nodes.push({
        id: workspaceId,
        browser_name: "vivaldi",
        os_type: osType,
        profile_name: profileName,
        node_type: "workspace",
        title: ws.name || `Workspace ${wsIdx + 1}`,
        url: null,
        parent_id: windowId,
        sort_order: wsIdx,
        snapshot_time: snapshotTime,
      });
    });
  } else {
    // Default workspace if workspaces feature not populated
    nodes.push({
      id: `vivaldi-${profileName}-ws-default`,
      browser_name: "vivaldi",
      os_type: osType,
      profile_name: profileName,
      node_type: "workspace",
      title: "Main Workspace",
      url: null,
      parent_id: windowId,
      sort_order: 0,
      snapshot_time: snapshotTime,
    });
  }

  // Parse tab groups / stacks
  const tabGroups = vivaldiSection?.tab_groups || {};
  let groupIndex = 0;
  for (const [groupId, groupData] of Object.entries<any>(tabGroups)) {
    const parentWsId = groupData?.workspace_id
      ? `vivaldi-ws-${groupData.workspace_id}`
      : `vivaldi-${profileName}-ws-default`;

    nodes.push({
      id: `vivaldi-stack-${groupId}`,
      browser_name: "vivaldi",
      os_type: osType,
      profile_name: profileName,
      node_type: "folder",
      title: groupData?.name || `Tab Stack ${groupIndex + 1}`,
      url: null,
      parent_id: parentWsId,
      sort_order: groupIndex++,
      snapshot_time: snapshotTime,
    });
  }

  return nodes;
}
