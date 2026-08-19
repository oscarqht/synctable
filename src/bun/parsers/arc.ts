import { existsSync, readFileSync } from "node:fs";
import type { BrowserTreeNode, OSType } from "../../shared/types";

export interface ArcParserOptions {
  filePath: string;
  osType: OSType;
  profileName: string;
  snapshotTime: string;
}

export function parseArcSidebar(options: ArcParserOptions): BrowserTreeNode[] {
  const { filePath, osType, profileName, snapshotTime } = options;
  if (!existsSync(filePath)) return [];

  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  const nodes: BrowserTreeNode[] = [];

  const rootId = `arc-${osType}-${profileName}-root`;
  nodes.push({
    id: rootId,
    browser_name: "arc",
    os_type: osType,
    profile_name: profileName,
    node_type: "root",
    title: "Arc Browser",
    url: null,
    parent_id: null,
    sort_order: 0,
    snapshot_time: snapshotTime,
  });

  const windowId = `arc-${profileName}-win-default`;
  nodes.push({
    id: windowId,
    browser_name: "arc",
    os_type: osType,
    profile_name: profileName,
    node_type: "window",
    title: "Main Window",
    url: null,
    parent_id: rootId,
    sort_order: 0,
    snapshot_time: snapshotTime,
  });

  // StorableSidebar format usually has sidebar -> containers -> spaces & items
  const sidebar = data?.sidebar || data;
  const spaces = sidebar?.spaces || [];
  const items = sidebar?.items || [];

  const itemMap = new Map<string, any>();
  if (Array.isArray(items)) {
    for (const it of items) {
      if (it?.id) itemMap.set(it.id, it);
    }
  } else if (typeof items === "object") {
    for (const key of Object.keys(items)) {
      itemMap.set(key, items[key]);
    }
  }

  // Parse spaces
  if (Array.isArray(spaces)) {
    spaces.forEach((sp: any, idx: number) => {
      const spaceId = sp.id ? `arc-space-${sp.id}` : `arc-space-${idx}`;
      nodes.push({
        id: spaceId,
        browser_name: "arc",
        os_type: osType,
        profile_name: profileName,
        node_type: "workspace",
        title: sp.title || `Space ${idx + 1}`,
        url: null,
        parent_id: windowId,
        sort_order: idx,
        snapshot_time: snapshotTime,
      });

      // Parse items in space container
      const containerItems = sp.items || sp.customInfo?.itemIds || [];
      if (Array.isArray(containerItems)) {
        containerItems.forEach((itemId: string | any, itemIdx: number) => {
          const rawItem = typeof itemId === "string" ? itemMap.get(itemId) : itemId;
          if (rawItem) {
            parseArcItem(rawItem, spaceId, itemIdx, options, nodes, itemMap);
          }
        });
      }
    });
  }

  return nodes;
}

function parseArcItem(
  item: any,
  parentId: string,
  index: number,
  options: ArcParserOptions,
  nodes: BrowserTreeNode[],
  itemMap: Map<string, any>
) {
  const { osType, profileName, snapshotTime } = options;
  const isFolder = item.data?.type === "folder" || Array.isArray(item.childrenIds) || item.children;
  const id = `arc-item-${item.id || item.data?.id || Math.random().toString(36).substring(2, 9)}`;

  if (isFolder) {
    nodes.push({
      id,
      browser_name: "arc",
      os_type: osType,
      profile_name: profileName,
      node_type: "folder",
      title: item.title || item.data?.title || "Folder",
      url: null,
      parent_id: parentId,
      sort_order: index,
      snapshot_time: snapshotTime,
    });

    const children = item.childrenIds || item.children || [];
    if (Array.isArray(children)) {
      children.forEach((childId: string | any, childIdx: number) => {
        const childItem = typeof childId === "string" ? itemMap.get(childId) : childId;
        if (childItem) {
          parseArcItem(childItem, id, childIdx, options, nodes, itemMap);
        }
      });
    }
  } else {
    const url = item.data?.tab?.savedURL || item.data?.tab?.url || item.url || item.data?.url || null;
    const title = item.title || item.data?.tab?.savedTitle || item.data?.title || url || "Tab";
    const isPinned = item.data?.tab?.pinned || item.isPinned;

    nodes.push({
      id,
      browser_name: "arc",
      os_type: osType,
      profile_name: profileName,
      node_type: isPinned ? "pinned_tab" : "tab",
      title,
      url,
      parent_id: parentId,
      sort_order: index,
      snapshot_time: snapshotTime,
    });
  }
}
