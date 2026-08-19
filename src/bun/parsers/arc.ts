import { existsSync, readFileSync } from "node:fs";
import type { BrowserTreeNode, OSType } from "../../shared/types";

export interface ArcParserOptions {
  filePath: string;
  osType: OSType;
  profileName: string;
  snapshotTime: string;
}

type ArcItem = Record<string, any> & { id?: string; parentID?: string; childrenIds?: unknown[] };
const ARC_SECTION_ORDER_OFFSET = 1_000_000;

/** Arc writes `spaces` and `items` as alternating [id, value] entries. */
function toArcMap(entries: unknown): Map<string, ArcItem> {
  const result = new Map<string, ArcItem>();
  if (Array.isArray(entries)) {
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (typeof entry === "string" && entries[index + 1] && typeof entries[index + 1] === "object") {
        result.set(entry, { ...(entries[index + 1] as ArcItem), id: (entries[index + 1] as ArcItem).id ?? entry });
        index += 1;
      } else if (entry && typeof entry === "object" && (entry as ArcItem).id) {
        result.set((entry as ArcItem).id!, entry as ArcItem);
      }
    }
  } else if (entries && typeof entries === "object") {
    for (const [id, value] of Object.entries(entries)) {
      if (value && typeof value === "object") result.set(id, { ...(value as ArcItem), id: (value as ArcItem).id ?? id });
    }
  }
  return result;
}

function arcId(value: unknown, fallback: string): string {
  return String(value ?? fallback).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function itemKind(item: ArcItem): string | undefined {
  return Object.keys(item.data ?? {}).find((key) => ["tab", "list", "tabGroup", "itemContainer", "splitView"].includes(key));
}

function containerRoots(space: ArcItem): { id: string; pinned: boolean }[] {
  const roots: { id: string; pinned: boolean }[] = [];
  const values = space.newContainerIDs;
  if (!Array.isArray(values)) return roots;
  for (let index = 0; index < values.length - 1; index += 1) {
    const marker = values[index];
    const id = values[index + 1];
    if (typeof marker === "object" && marker && typeof id === "string") {
      roots.push({ id, pinned: "pinned" in marker });
      index += 1;
    }
  }
  return roots;
}

export function parseArcSidebar(options: ArcParserOptions): BrowserTreeNode[] {
  const { filePath, osType, profileName, snapshotTime } = options;
  if (!existsSync(filePath)) return [];
  const data = JSON.parse(readFileSync(filePath, "utf-8"));
  const containers = data?.sidebar?.containers ?? [data?.sidebar ?? data];
  const nodes: BrowserTreeNode[] = [];
  const rootId = `arc-${osType}-${arcId(profileName, "default")}-root`;
  const windowId = `arc-${arcId(profileName, "default")}-win-default`;
  const addNode = (node: Omit<BrowserTreeNode, "browser_name" | "os_type" | "profile_name" | "snapshot_time">) =>
    nodes.push({ ...node, browser_name: "arc", os_type: osType, profile_name: profileName, snapshot_time: snapshotTime });

  addNode({ id: rootId, node_type: "root", title: "Arc Browser", url: null, parent_id: null, sort_order: 0 });
  addNode({ id: windowId, node_type: "window", title: "Main Window", url: null, parent_id: rootId, sort_order: 0 });

  let workspaceIndex = 0;
  for (const container of containers) {
    const spaces = toArcMap(container?.spaces);
    const items = toArcMap(container?.items);
    for (const [spaceKey, space] of spaces) {
      const workspaceId = `arc-space-${arcId(space.id ?? spaceKey, `space-${workspaceIndex}`)}`;
      addNode({ id: workspaceId, node_type: "workspace", title: space.title || `Space ${workspaceIndex + 1}`, url: null, parent_id: windowId, sort_order: workspaceIndex++ });
      const visited = new Set<string>();
      const walk = (itemId: string, parentId: string, sortOrder: number, pinned: boolean): void => {
        if (visited.has(itemId)) return;
        const item = items.get(itemId);
        if (!item) return;
        visited.add(itemId);
        const kind = itemKind(item);
        const possibleChildren: unknown[] = Array.isArray(item.childrenIds)
          ? item.childrenIds
          : Array.isArray(item.children)
            ? item.children
            : [];
        const children = possibleChildren.filter((child): child is string => typeof child === "string");
        if (kind === "itemContainer") {
          // The container itself is not displayed in Arc. Keep the two sections
          // disjoint after flattening it so regular tabs cannot tie with (and
          // sort ahead of) pinned tabs in the database's global sort order.
          children.forEach((child, index) => walk(child, parentId, sortOrder + index, pinned));
          return;
        }
        const itemIdForTree = `arc-item-${arcId(item.id ?? itemId, itemId)}`;
        if (kind === "list" || kind === "tabGroup" || kind === "splitView" || children.length > 0) {
          addNode({ id: itemIdForTree, node_type: "folder", title: item.title || item.data?.tabGroup?.title || (kind === "splitView" ? "Split View" : "Folder"), url: null, parent_id: parentId, sort_order: sortOrder });
          children.forEach((child, index) => walk(child, itemIdForTree, index, pinned));
          return;
        }
        const tab = item.data?.tab ?? {};
        const url = tab.savedURL || tab.url || item.url || item.data?.url || null;
        addNode({ id: itemIdForTree, node_type: pinned || tab.pinned || item.isPinned ? "pinned_tab" : "tab", title: item.title || tab.savedTitle || item.data?.title || url || "Tab", url, parent_id: parentId, sort_order: sortOrder });
      };
      const roots = containerRoots(space).sort((left, right) => Number(right.pinned) - Number(left.pinned));
      roots.forEach((root, index) => walk(root.id, workspaceId, index * ARC_SECTION_ORDER_OFFSET, root.pinned));
      if (roots.length === 0) {
        [...items.entries()].filter(([, item]) => item.parentID === space.id || item.parentID === spaceKey).forEach(([itemId], index) => walk(itemId, workspaceId, index, false));
      }
    }
  }
  return nodes;
}
