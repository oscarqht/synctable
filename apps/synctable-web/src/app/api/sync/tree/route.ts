import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  findSynctableCollection,
  fetchCollectionRaindrops,
  fetchRaindropFileContent,
} from "@/lib/raindrop";
import type {
  BrowserTreeNode,
  DeviceStats,
  DeviceTreeData,
  SynctableSyncResponse,
} from "@/lib/types";

export const dynamic = "force-dynamic";

function calculateNodeStats(nodes: BrowserTreeNode[]): {
  totalNodes: number;
  totalTabs: number;
  totalWorkspaces: number;
  totalFolders: number;
  totalWindows: number;
  browsersSet: Set<string>;
} {
  let totalNodes = 0;
  let totalTabs = 0;
  let totalWorkspaces = 0;
  let totalFolders = 0;
  let totalWindows = 0;
  const browsersSet = new Set<string>();

  function traverse(node: BrowserTreeNode) {
    totalNodes++;
    if (node.browser_name) {
      browsersSet.add(node.browser_name.toLowerCase());
    }

    if (node.node_type === "tab" || node.node_type === "pinned_tab") {
      totalTabs++;
    } else if (node.node_type === "workspace") {
      totalWorkspaces++;
    } else if (node.node_type === "folder") {
      totalFolders++;
    } else if (node.node_type === "window") {
      totalWindows++;
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return {
    totalNodes,
    totalTabs,
    totalWorkspaces,
    totalFolders,
    totalWindows,
    browsersSet,
  };
}

/**
 * Ensure nodes have proper tree structure if returned flat.
 */
function ensureTreeHierarchy(nodes: any[]): BrowserTreeNode[] {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return [];
  }

  // Check if it's already a tree (some items have children arrays)
  const hasChildrenField = nodes.some(
    (n) => n.children && Array.isArray(n.children) && n.children.length > 0
  );
  if (hasChildrenField) {
    return nodes as BrowserTreeNode[];
  }

  // If flat array with parent_id, assemble tree
  const nodeMap = new Map<string, BrowserTreeNode>();
  const rootNodes: BrowserTreeNode[] = [];

  for (const node of nodes) {
    if (node && node.id) {
      nodeMap.set(String(node.id), { ...node, children: [] });
    }
  }

  for (const node of nodes) {
    if (!node || !node.id) continue;
    const current = nodeMap.get(String(node.id))!;
    if (node.parent_id && nodeMap.has(String(node.parent_id))) {
      const parent = nodeMap.get(String(node.parent_id))!;
      parent.children = parent.children || [];
      parent.children.push(current);
    } else {
      rootNodes.push(current);
    }
  }

  return rootNodes.length > 0 ? rootNodes : (nodes as BrowserTreeNode[]);
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.json(
      {
        authenticated: false,
        collection: null,
        devices: [],
        error: "Not authenticated with Raindrop",
      } satisfies SynctableSyncResponse,
      { status: 401 }
    );
  }

  try {
    // 1. Find root collection "Synctable"
    const collection = await findSynctableCollection(token);

    if (!collection) {
      return NextResponse.json({
        authenticated: true,
        collection: null,
        devices: [],
      } satisfies SynctableSyncResponse);
    }

    // 2. Fetch all raindrop items in Synctable collection
    const items = await fetchCollectionRaindrops(token, collection._id);

    // 3. Fetch and parse file content for each device item
    const deviceResults = await Promise.all(
      items.map(async (item) => {
        const rawContent = await fetchRaindropFileContent(token, item);
        const tree = rawContent ? ensureTreeHierarchy(rawContent) : [];

        const statsCalculated = calculateNodeStats(tree);
        const stats: DeviceStats = {
          totalNodes: statsCalculated.totalNodes,
          totalTabs: statsCalculated.totalTabs,
          totalWorkspaces: statsCalculated.totalWorkspaces,
          totalFolders: statsCalculated.totalFolders,
          totalWindows: statsCalculated.totalWindows,
          browsers: Array.from(statsCalculated.browsersSet),
        };

        const rawFileName =
          item.file?.name || item.title || `device_${item._id}`;
        const deviceId = rawFileName
          .replace(/\.(txt|json)$/i, "")
          .replace(/[^a-zA-Z0-9_-]/g, "_");

        // Excerpt is used by syncTree to store readable device name
        const deviceName =
          item.excerpt?.trim() ||
          item.title?.replace(/\.(txt|json)$/i, "") ||
          `Device ${deviceId.slice(0, 8)}`;

        return {
          id: item._id,
          deviceId,
          deviceName,
          fileName: rawFileName,
          fileSize: item.file?.size,
          lastUpdated: item.lastUpdate || item.created || new Date().toISOString(),
          tree,
          stats,
        } satisfies DeviceTreeData;
      })
    );

    return NextResponse.json({
      authenticated: true,
      collection: {
        id: collection._id,
        title: collection.title,
        count: collection.count ?? items.length,
      },
      devices: deviceResults,
    } satisfies SynctableSyncResponse);
  } catch (err: any) {
    console.error("[API] Error fetching Synctable data:", err);
    return NextResponse.json(
      {
        authenticated: true,
        collection: null,
        devices: [],
        error: err?.message || "Failed to fetch Synctable data from Raindrop",
      } satisfies SynctableSyncResponse,
      { status: 500 }
    );
  }
}
