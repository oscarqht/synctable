import { existsSync, readFileSync } from "node:fs";
import type { BrowserTreeNode, OSType } from "../../shared/types";

export interface VivaldiParserOptions {
  filePath: string;
  sessionFilePath?: string;
  osType: OSType;
  profileName: string;
  snapshotTime: string;
}

type SessionTab = { id: number; windowId?: number; index: number; url?: string; title?: string; pinned: boolean; groupId?: string; groupTitle?: string; workspaceId?: string; tiling?: { id: string; index: number }; vivaldiGroup?: boolean };
type TabGroup = { id: string; title: string };
const SESSION_MAGIC = "SNSS";

function readPickleString(buffer: Buffer, offset: number): string | undefined {
  if (offset + 4 > buffer.length) return undefined;
  const length = buffer.readInt32LE(offset);
  if (length < 0 || offset + 4 + length > buffer.length) return undefined;
  return buffer.subarray(offset + 4, offset + 4 + length).toString("utf8");
}

function readPickleString16(buffer: Buffer, offset: number): string | undefined {
  if (offset + 4 > buffer.length) return undefined;
  const length = buffer.readInt32LE(offset);
  const byteLength = length * 2;
  if (length < 0 || offset + 4 + byteLength > buffer.length) return undefined;
  return buffer.subarray(offset + 4, offset + 4 + byteLength).toString("utf16le");
}

function tokenId(buffer: Buffer, offset: number): string {
  return `${buffer.readBigUInt64LE(offset).toString(16)}-${buffer.readBigUInt64LE(offset + 8).toString(16)}`;
}

/** Reads Vivaldi's Chromium Session_* snapshot: tabs, order, pinned state, and tab groups. */
function parseSessionSnapshot(sessionFilePath?: string): { tabs: SessionTab[]; groups: TabGroup[] } {
  if (!sessionFilePath || !existsSync(sessionFilePath)) return { tabs: [], groups: [] };
  const buffer = readFileSync(sessionFilePath);
  if (buffer.length < 8 || buffer.subarray(0, 4).toString("ascii") !== SESSION_MAGIC) return { tabs: [], groups: [] };

  const tabs = new Map<number, SessionTab>();
  const groups = new Map<string, TabGroup>();
  const tab = (id: number) => {
    let value = tabs.get(id);
    if (!value) {
      value = { id, index: Number.MAX_SAFE_INTEGER, pinned: false };
      tabs.set(id, value);
    }
    return value;
  };

  // A command is: uint16 (command id + payload size), uint8 command id, payload.
  for (let offset = 8; offset + 2 <= buffer.length;) {
    const recordLength = buffer.readUInt16LE(offset);
    if (recordLength < 1 || offset + 2 + recordLength > buffer.length) break;
    const command = buffer[offset + 2];
    const payload = buffer.subarray(offset + 3, offset + 2 + recordLength);
    offset += 2 + recordLength;

    if (command === 0 && payload.length >= 8) { // SetTabWindow
      tab(payload.readInt32LE(4)).windowId = payload.readInt32LE(0);
    } else if (command === 2 && payload.length >= 8) { // SetTabIndexInWindow
      const value = tab(payload.readInt32LE(0));
      value.index = payload.readInt32LE(4);
    } else if (command === 6 && payload.length >= 16) { // UpdateTabNavigation
      const value = tab(payload.readInt32LE(4));
      const url = readPickleString(payload, 12);
      if (url && /^(https?|file|chrome|vivaldi):/i.test(url)) value.url = url;
      // SerializedNavigationEntry writes its UTF-16 page title immediately after the URL.
      const urlEnd = url ? 16 + Buffer.byteLength(url) : 16;
      const title = readPickleString16(payload, (urlEnd + 3) & ~3);
      if (title) value.title = title;
    } else if (command === 12 && payload.length >= 5) { // SetPinnedState
      tab(payload.readInt32LE(0)).pinned = payload[4] !== 0;
    } else if (command === 25 && payload.length >= 21) { // SetTabGroup
      const value = tab(payload.readInt32LE(0));
      if (payload[20] !== 0) value.groupId = tokenId(payload, 4);
    } else if (command === 27 && payload.length >= 24) { // SetTabGroupMetadata2
      const groupId = tokenId(payload, 4);
      const title = readPickleString(payload, 20);
      groups.set(groupId, { id: groupId, title: title || "Tab Group" });
    } else if (command === 16 && payload.length >= 4) { // TabClosed
      tabs.delete(payload.readInt32LE(0));
    } else if (command === 21 && payload.length >= 12) { // Vivaldi SetTabData
      const value = tab(payload.readInt32LE(4));
      const json = readPickleString(payload, 8);
      if (!json) continue;
      try {
        const data = JSON.parse(json) as { fixedTitle?: unknown; group?: unknown; fixedGroupTitle?: unknown; workspaceId?: unknown; tiling?: { id?: unknown; index?: unknown } };
        if (typeof data.fixedTitle === "string" && data.fixedTitle) value.title = data.fixedTitle;
        // Vivaldi writes the complete current tab-data object. Therefore an omitted
        // group/title clears an older value in the append-only session log.
        value.vivaldiGroup = true;
        value.groupId = typeof data.group === "string" && data.group ? data.group : undefined;
        value.groupTitle = typeof data.fixedGroupTitle === "string" && data.fixedGroupTitle ? data.fixedGroupTitle : undefined;
        // Workspace membership is stored with Vivaldi's tab metadata, rather than
        // the Chromium session records. Missing metadata means Vivaldi's default
        // workspace; it must not fall through to the first named workspace.
        value.workspaceId = typeof data.workspaceId === "string" || typeof data.workspaceId === "number"
          ? String(data.workspaceId)
          : undefined;
        // Tiled tabs share a tiling ID. The index is their visual position in the
        // split layout, which can differ from their order in the tab strip.
        value.tiling = typeof data.tiling?.id === "string" && data.tiling.id && typeof data.tiling.index === "number" && Number.isFinite(data.tiling.index)
          ? { id: data.tiling.id, index: data.tiling.index }
          : undefined;
      } catch {
        // This command may contain non-Vivaldi tab data. It is safe to ignore.
      }
    }
  }
  for (const value of tabs.values()) {
    if (!value.vivaldiGroup || !value.groupId) continue;
    const group = groups.get(value.groupId) || { id: value.groupId, title: "Tab Stack" };
    // An unnamed Vivaldi stack displays the first tab title as its label.
    if (value.groupTitle) group.title = value.groupTitle;
    else if (group.title === "Tab Stack") group.title = value.title || "Tab Stack";
    groups.set(value.groupId, group);
  }
  return { tabs: [...tabs.values()].filter((item) => item.url), groups: [...groups.values()] };
}

function tabTitle(url: string): string {
  try { return new URL(url).hostname || url; } catch { return url; }
}

export function parseVivaldiPreferences(options: VivaldiParserOptions): BrowserTreeNode[] {
  const { filePath, sessionFilePath, osType, profileName, snapshotTime } = options;
  if (!existsSync(filePath)) return [];
  const data = JSON.parse(readFileSync(filePath, "utf-8"));
  const nodes: BrowserTreeNode[] = [];
  const rootId = `vivaldi-${osType}-${profileName}-root`;
  const session = parseSessionSnapshot(sessionFilePath);
  nodes.push({ id: rootId, browser_name: "vivaldi", os_type: osType, profile_name: profileName, node_type: "root", title: `Vivaldi (${profileName})`, url: null, parent_id: null, sort_order: 0, snapshot_time: snapshotTime, lastUpdateTime: snapshotTime });

  const workspaceItems = Array.isArray(data?.vivaldi?.workspaces?.list) ? data.vivaldi.workspaces.list : [];
  const workspaces: { id: string; title: string }[] = workspaceItems.length > 0
    ? workspaceItems.map((workspace: any, index: number) => ({ id: String(workspace.id ?? index), title: workspace.name || `Workspace ${index + 1}` }))
    : [{ id: "default", title: "Main Workspace" }];
  const sessionWindowIds = [...new Set(session.tabs.map((item) => item.windowId).filter((id): id is number => id !== undefined))];
  const windowIds = sessionWindowIds.length > 0 ? sessionWindowIds : [0];

  windowIds.forEach((sourceWindowId, windowIndex) => {
    const windowId = `vivaldi-${profileName}-win-${sourceWindowId}`;
    nodes.push({ id: windowId, browser_name: "vivaldi", os_type: osType, profile_name: profileName, node_type: "window", title: `Vivaldi Window ${windowIndex + 1}`, url: null, parent_id: rootId, sort_order: windowIndex, snapshot_time: snapshotTime, lastUpdateTime: snapshotTime });
    const windowTabs = session.tabs.filter((item) => item.windowId === sourceWindowId);
    const knownWorkspaceIds = new Set(workspaces.map((workspace) => workspace.id));
    const needsDefaultWorkspace = workspaceItems.length > 0
      && windowTabs.some((item) => !item.workspaceId || !knownWorkspaceIds.has(item.workspaceId));
    const defaultWorkspaceId = `vivaldi-${profileName}-win-${sourceWindowId}-ws-default`;
    const workspaceNodeId = (sourceWorkspaceId?: string) => sourceWorkspaceId && knownWorkspaceIds.has(sourceWorkspaceId)
      ? `vivaldi-${profileName}-win-${sourceWindowId}-ws-${sourceWorkspaceId}`
      : defaultWorkspaceId;

    if (needsDefaultWorkspace) {
      nodes.push({ id: defaultWorkspaceId, browser_name: "vivaldi", os_type: osType, profile_name: profileName, node_type: "workspace", title: "Main Workspace", url: null, parent_id: windowId, sort_order: 0, snapshot_time: snapshotTime, lastUpdateTime: snapshotTime });
    }
    workspaces.forEach((workspace: { id: string; title: string }, workspaceIndex: number) => {
      const workspaceId = `vivaldi-${profileName}-win-${sourceWindowId}-ws-${workspace.id}`;
      nodes.push({ id: workspaceId, browser_name: "vivaldi", os_type: osType, profile_name: profileName, node_type: "workspace", title: workspace.title, url: null, parent_id: windowId, sort_order: workspaceIndex + (needsDefaultWorkspace ? 1 : 0), snapshot_time: snapshotTime, lastUpdateTime: snapshotTime });
    });
    const windowGroupIds = new Set(windowTabs.filter((item) => item.groupId).map((item) => item.groupId!));
    const groups = session.groups
      .filter((group) => windowGroupIds.has(group.id))
      .map((group) => {
        const groupTabs = windowTabs.filter((item) => item.groupId === group.id);
        return { group, workspaceId: workspaceNodeId(groupTabs[0]?.workspaceId), firstTabIndex: Math.min(...groupTabs.map((item) => item.index)) };
      });
    const groupNodeId = (groupId: string) => `vivaldi-${profileName}-win-${sourceWindowId}-group-${groupId}`;
    groups.forEach(({ group, workspaceId, firstTabIndex }) => nodes.push({ id: groupNodeId(group.id), browser_name: "vivaldi", os_type: osType, profile_name: profileName, node_type: "folder", title: group.title, url: null, parent_id: workspaceId, sort_order: firstTabIndex, snapshot_time: snapshotTime, lastUpdateTime: snapshotTime }));
    const windowSplitIds = new Set(windowTabs.flatMap((item) => item.tiling ? [item.tiling.id] : []));
    const splits = [...windowSplitIds].map((splitId) => {
      const splitTabs = windowTabs.filter((item) => item.tiling?.id === splitId);
      const containingGroupIds = new Set(splitTabs.flatMap((item) => item.groupId ? [item.groupId] : []));
      return {
        id: splitId,
        parentId: containingGroupIds.size === 1 && windowGroupIds.has([...containingGroupIds][0])
          ? groupNodeId([...containingGroupIds][0])
          : workspaceNodeId(splitTabs[0]?.workspaceId),
        firstTabIndex: Math.min(...splitTabs.map((item) => item.index)),
      };
    });
    const splitNodeId = (splitId: string) => `vivaldi-${profileName}-win-${sourceWindowId}-split-${splitId}`;
    splits.forEach((split) => nodes.push({ id: splitNodeId(split.id), browser_name: "vivaldi", os_type: osType, profile_name: profileName, node_type: "split_view", title: "Split View", url: null, parent_id: split.parentId, sort_order: split.firstTabIndex, snapshot_time: snapshotTime, lastUpdateTime: snapshotTime }));
    windowTabs.sort((left, right) => left.index - right.index || left.id - right.id).forEach((item) => {
      // A tiled set can be nested inside one tab stack. Tabs remain direct
      // children of the split view rather than being duplicated in the stack.
      const parentId = item.tiling
        ? splitNodeId(item.tiling.id)
        : item.groupId && windowGroupIds.has(item.groupId)
          ? groupNodeId(item.groupId)
          : workspaceNodeId(item.workspaceId);
      nodes.push({ id: `vivaldi-${profileName}-tab-${item.id}`, browser_name: "vivaldi", os_type: osType, profile_name: profileName, node_type: item.pinned ? "pinned_tab" : "tab", title: item.title || tabTitle(item.url!), url: item.url!, parent_id: parentId, sort_order: item.tiling?.index ?? item.index, snapshot_time: snapshotTime, lastUpdateTime: snapshotTime });
    });
  });
  return nodes;
}
