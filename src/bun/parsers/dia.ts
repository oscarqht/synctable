import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, dirname, join } from "node:path";
import type { BrowserTreeNode, OSType } from "../../shared/types";

type DiaScalar = string | number | null | { $blob: string };
type DiaRow = Record<string, DiaScalar>;

export interface DiaDatabaseDump {
  path: string;
  context: string;
  tables: Record<string, DiaRow[]>;
}

interface DiaDump {
  databases: DiaDatabaseDump[];
}

export interface DiaParserOptions {
  userDataPath: string;
  osType: OSType;
  snapshotTime: string;
  helperPath?: string;
}

interface ProfileModel {
  directory: string;
  rows: Record<string, DiaRow[]>;
  nodes: DiaNode[];
  childrenByParent: Map<string, DiaNode[]>;
  spaces: DiaSpace[];
  windows: DiaWindow[];
}

interface DiaNode {
  id: string;
  kind: string;
  entityId: string;
  parentId: string | null;
  order: number;
  spaceId: string | null;
}

interface DiaSpace {
  id: string;
  title: string;
}

interface DiaWindow {
  id: string;
  nodeId: string;
  focusedSpaceId: string | null;
  order: number;
}

function resolveHelper(explicitPath?: string): string {
  const candidates = [
    explicitPath,
    process.env.SYNCTABLE_DIA_HELPER,
    join(process.cwd(), "src", "native", "bin", "dia-db-reader"),
    join(import.meta.dir, "..", "..", "native", "bin", "dia-db-reader"),
    join(import.meta.dir, "..", "bin", "dia-db-reader"),
    join(import.meta.dir, "..", "..", "bin", "dia-db-reader"),
  ].filter((path): path is string => Boolean(path));
  const helper = candidates.find(existsSync);
  if (!helper) throw new Error("Dia database reader is missing. Run `bun run build:native`.");
  return helper;
}

function profileDirectories(userDataPath: string): string[] {
  if (!existsSync(userDataPath)) return [];
  return readdirSync(userDataPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(userDataPath, entry.name, "tabs.db")))
    .map((entry) => entry.name)
    .sort((left, right) => {
      if (left === "Default") return -1;
      if (right === "Default") return 1;
      const leftNumber = Number(left.match(/^Profile (\d+)$/)?.[1] || Number.MAX_SAFE_INTEGER);
      const rightNumber = Number(right.match(/^Profile (\d+)$/)?.[1] || Number.MAX_SAFE_INTEGER);
      return leftNumber - rightNumber || left.localeCompare(right);
    });
}

export function parseDiaTree(options: DiaParserOptions): BrowserTreeNode[] {
  if (options.osType !== "macos") return [];
  const profiles = profileDirectories(options.userDataPath);
  if (profiles.length === 0) return [];

  const args = profiles.flatMap((profile) => [
    join(options.userDataPath, profile, "tabs.db"),
    `profile/${profile}/tabs`,
  ]);
  const result = spawnSync(resolveHelper(options.helperPath), args, {
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Could not read Dia's local databases.");
  }
  return buildDiaNodes(JSON.parse(result.stdout) as DiaDump, options);
}

export function buildDiaNodes(
  dump: DiaDump,
  options: Pick<DiaParserOptions, "osType" | "snapshotTime">,
): BrowserTreeNode[] {
  const profiles = dump.databases
    .map(buildProfileModel)
    .sort((left, right) => profileDirectoryOrder(left.directory, right.directory));
  const profileName = "Default";
  const rootId = `dia-${options.osType}-root`;
  const output: BrowserTreeNode[] = [treeNode(
    rootId,
    "root",
    "Dia",
    null,
    null,
    0,
    options,
    profileName,
  )];

  const windowCount = Math.max(0, ...profiles.map((profile) => profile.windows.length));
  for (let windowIndex = 0; windowIndex < windowCount; windowIndex++) {
    const windowId = `${rootId}-window-${windowIndex}`;
    output.push(treeNode(
      windowId,
      "window",
      `Window ${windowIndex + 1}`,
      null,
      rootId,
      windowIndex,
      options,
      profileName,
    ));

    let spaceOrder = 0;
    for (const profile of profiles) {
      const window = profile.windows[windowIndex];
      if (!window) continue;
      const spaces = profile.spaces.length > 0
        ? profile.spaces
        : [{ id: window.focusedSpaceId || profile.directory, title: profile.directory }];
      for (const space of spaces) {
        const spaceId = `${windowId}-profile-${encodeURIComponent(profile.directory)}-space-${encodeURIComponent(space.id)}`;
        output.push(treeNode(
          spaceId,
          "workspace",
          space.title,
          null,
          windowId,
          spaceOrder++,
          options,
          profileName,
        ));
        appendSpaceItems(output, profile, window, space, spaceId, options, profileName);
      }
    }
  }

  return output;
}

function buildProfileModel(database: DiaDatabaseDump): ProfileModel {
  const rows = database.tables || {};
  const directory = basename(dirname(database.path));
  const nodes = (rows.nodes || [])
    .filter((row) => value(row, "deleted_at", "deletedAt") == null)
    .map((row) => ({
      id: stringValue(row, "id"),
      kind: stringValue(row, "kind"),
      entityId: stringValue(row, "entity_id", "entityID", "entityId"),
      parentId: nullableString(row, "parent_id", "parentID", "parentId"),
      order: numberValue(row, "order"),
      spaceId: nullableString(row, "space_id", "spaceID", "spaceId"),
    }))
    .filter((node) => node.id && node.kind);
  const childrenByParent = new Map<string, DiaNode[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const children = childrenByParent.get(node.parentId) || [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  }
  for (const children of childrenByParent.values()) children.sort(compareNodes);

  const spaces = (rows.spaces || []).map((row) => ({
    id: stringValue(row, "id"),
    title: stringValue(row, "title") || directory,
  })).filter((space) => space.id);

  const windowRows = new Map((rows.windows || []).map((row) => [stringValue(row, "node_id", "nodeID", "nodeId"), row]));
  const windows = nodes
    .filter((node) => node.kind === "window")
    .map((node) => {
      const row = windowRows.get(node.id) || (rows.windows || []).find((candidate) => stringValue(candidate, "id") === node.entityId);
      return {
        id: row ? stringValue(row, "id") : node.entityId || node.id,
        nodeId: node.id,
        focusedSpaceId: row ? nullableString(row, "focused_space_id", "focusedSpaceID", "focusedSpaceId") : null,
        order: node.order,
      };
    })
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));

  return { directory, rows, nodes, childrenByParent, spaces, windows };
}

function appendSpaceItems(
  output: BrowserTreeNode[],
  profile: ProfileModel,
  window: DiaWindow,
  space: DiaSpace,
  parentId: string,
  options: Pick<DiaParserOptions, "osType" | "snapshotTime">,
  profileName: string,
) {
  const sharedContainers = profile.nodes
    .filter((node) => !node.parentId && (node.kind === "favorites" || node.kind === "pinned_container"))
    .filter((node) => !node.spaceId || node.spaceId === space.id)
    .sort(compareNodes);
  const pinned = sharedContainers.flatMap((container) => profile.childrenByParent.get(container.id) || []);
  const windowItems = (profile.childrenByParent.get(window.nodeId) || [])
    .filter((node) => !node.spaceId || node.spaceId === space.id);
  const items = [...pinned, ...windowItems]
    .filter((node) => node.kind === "tab" || node.kind === "group")
    .filter((node, index, all) => all.findIndex((candidate) => candidate.id === node.id) === index);

  items.forEach((item, index) => appendLogicalNode(
    output,
    profile,
    item,
    parentId,
    index,
    `${parentId}-item`,
    options,
    profileName,
    pinned.some((candidate) => candidate.id === item.id),
  ));
}

function appendLogicalNode(
  output: BrowserTreeNode[],
  profile: ProfileModel,
  source: DiaNode,
  parentId: string,
  sortOrder: number,
  idPrefix: string,
  options: Pick<DiaParserOptions, "osType" | "snapshotTime">,
  profileName: string,
  pinned: boolean,
) {
  const id = `${idPrefix}-${encodeURIComponent(profile.directory)}-${encodeURIComponent(source.id)}`;
  if (source.kind === "group") {
    const record = findEntityRow(profile.rows.tab_groups || [], source);
    const title = record ? stringValue(record, "title") : "Tab Group";
    output.push(treeNode(id, "folder", title || "Tab Group", null, parentId, sortOrder, options, profileName));
    const children = (profile.childrenByParent.get(source.id) || [])
      .filter((child) => child.kind === "tab" || child.kind === "group");
    children.forEach((child, index) => appendLogicalNode(
      output,
      profile,
      child,
      id,
      index,
      `${id}-child`,
      options,
      profileName,
      pinned,
    ));
    return;
  }

  const metadata = tabMetadata(profile, source);
  output.push(treeNode(
    id,
    pinned ? "pinned_tab" : "tab",
    metadata.title,
    metadata.url,
    parentId,
    sortOrder,
    options,
    profileName,
  ));
}

function tabMetadata(profile: ProfileModel, tabNode: DiaNode): { title: string; url: string | null } {
  const paneNodes: DiaNode[] = [];
  const visit = (node: DiaNode) => {
    for (const child of profile.childrenByParent.get(node.id) || []) {
      if (child.kind === "content_pane") paneNodes.push(child);
      else visit(child);
    }
  };
  visit(tabNode);
  paneNodes.sort(compareNodes);

  for (const paneNode of paneNodes) {
    const pane = findEntityRow(profile.rows.content_panes || [], paneNode);
    if (!pane) continue;
    const paneId = stringValue(pane, "id") || paneNode.entityId;
    const web = (profile.rows.web_contents || []).find((row) => stringValue(row, "content_pane_id", "contentPaneID", "contentPaneId") === paneId);
    const supertab = (profile.rows.supertabs || []).find((row) => stringValue(row, "content_pane_id", "contentPaneID", "contentPaneId") === paneId);
    const url = web ? nullableString(web, "url") : null;
    const title = stringValue(pane, "custom_title", "customTitle")
      || (supertab ? stringValue(supertab, "title") : "")
      || (web ? stringValue(web, "title") : "")
      || (isNewTabUrl(url) ? "New Tab" : url)
      || "New Tab";
    return { title, url };
  }
  return { title: "New Tab", url: null };
}

function isNewTabUrl(url: string | null): boolean {
  return Boolean(url && /^(?:dia|chrome):\/\/(?:newtab|new-tab-page)\/?$/i.test(url));
}

function findEntityRow(rows: DiaRow[], node: DiaNode): DiaRow | undefined {
  return rows.find((row) => stringValue(row, "id") === node.entityId)
    || rows.find((row) => stringValue(row, "node_id", "nodeID", "nodeId") === node.id);
}

function compareNodes(left: DiaNode, right: DiaNode): number {
  return left.order - right.order || left.id.localeCompare(right.id);
}

function profileDirectoryOrder(left: string, right: string): number {
  if (left === "Default") return -1;
  if (right === "Default") return 1;
  const leftNumber = Number(left.match(/^Profile (\d+)$/)?.[1] || Number.MAX_SAFE_INTEGER);
  const rightNumber = Number(right.match(/^Profile (\d+)$/)?.[1] || Number.MAX_SAFE_INTEGER);
  return leftNumber - rightNumber || left.localeCompare(right);
}

function value(row: DiaRow, ...keys: string[]): DiaScalar | undefined {
  for (const key of keys) if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  return undefined;
}

function stringValue(row: DiaRow, ...keys: string[]): string {
  const raw = value(row, ...keys);
  return typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "";
}

function nullableString(row: DiaRow, ...keys: string[]): string | null {
  return stringValue(row, ...keys) || null;
}

function numberValue(row: DiaRow, ...keys: string[]): number {
  const raw = value(row, ...keys);
  return typeof raw === "number" ? raw : Number(raw) || 0;
}

function treeNode(
  id: string,
  nodeType: BrowserTreeNode["node_type"],
  title: string,
  url: string | null,
  parentId: string | null,
  sortOrder: number,
  options: Pick<DiaParserOptions, "osType" | "snapshotTime">,
  profileName: string,
): BrowserTreeNode {
  return {
    id,
    browser_name: "dia",
    os_type: options.osType,
    profile_name: profileName,
    node_type: nodeType,
    title,
    url,
    parent_id: parentId,
    sort_order: sortOrder,
    snapshot_time: options.snapshotTime,
  };
}
