import type { BrowserTreeNode } from "./types";

/**
 * Checks whether a URL starts with http:// or https:// (case-insensitive)
 */
export function isValidHttpUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

/**
 * Recursively count the number of valid http/https tabs under a node.
 */
export function countTabs(node: BrowserTreeNode): number {
  if (!node) return 0;
  if (node.node_type === "tab" || node.node_type === "pinned_tab") {
    return isValidHttpUrl(node.url) ? 1 : 0;
  }
  if (!node.children || !Array.isArray(node.children) || node.children.length === 0) {
    return isValidHttpUrl(node.url) ? 1 : 0;
  }
  return node.children.reduce((sum, child) => sum + countTabs(child), 0);
}

/**
 * Recursively prune empty containers and invalid/non-http tabs.
 * Returns null if the node itself or all of its children are empty.
 */
export function pruneEmptyNodes(node: BrowserTreeNode): BrowserTreeNode | null {
  if (!node) return null;

  // Leaf tab nodes: keep only if it has a valid http/https URL
  if (node.node_type === "tab" || node.node_type === "pinned_tab") {
    return isValidHttpUrl(node.url) ? node : null;
  }

  // Leaf node with no children: keep only if it has a valid http/https URL
  if (!node.children || !Array.isArray(node.children) || node.children.length === 0) {
    return isValidHttpUrl(node.url) ? node : null;
  }

  // Recursively prune children
  const prunedChildren = node.children
    .map(pruneEmptyNodes)
    .filter((child): child is BrowserTreeNode => child !== null);

  // If no children remain with valid http/https tabs, prune this container
  if (prunedChildren.length === 0) {
    return null;
  }

  return {
    ...node,
    children: prunedChildren,
  };
}

/**
 * Recursively count non-empty workspaces under a node.
 */
export function countWorkspaces(node: BrowserTreeNode): number {
  if (!node) return 0;
  return extractWorkspacesFromRoot(node).length;
}

export interface WorkspaceItem {
  id: string;
  browserName: string;
  browserTitle: string;
  profileName: string;
  windowTitle?: string;
  workspaceTitle: string;
  node: BrowserTreeNode;
  tabCount: number;
}

/**
 * Extracts individual non-empty workspace units from a browser root node.
 * For browsers with multiple profiles, windows, or workspaces, each workspace is returned
 * so it can be rendered as a separate card.
 */
export function extractWorkspacesFromRoot(rawRootNode: BrowserTreeNode): WorkspaceItem[] {
  const rootNode = pruneEmptyNodes(rawRootNode);
  if (!rootNode || countTabs(rootNode) === 0) return [];

  const browserName = (rootNode.browser_name || "browser").toLowerCase();
  const browserTitle = rootNode.title || rootNode.browser_name || "Browser";
  const profileName = rootNode.profile_name || "Default";

  const list: WorkspaceItem[] = [];

  // Check if rootNode has window children
  const windowChildren = (rootNode.children || []).filter(
    (c) => c.node_type === "window" && countTabs(c) > 0
  );

  if (windowChildren.length > 0) {
    for (const win of windowChildren) {
      const workspaceChildren = (win.children || []).filter(
        (c) => c.node_type === "workspace" && countTabs(c) > 0
      );

      if (workspaceChildren.length > 0) {
        for (const ws of workspaceChildren) {
          let wsTitle = ws.title?.trim() || "";
          if (!wsTitle || wsTitle === "Default Workspace" || wsTitle === "Main Workspace") {
            if (win.title && win.title !== "Main Window" && win.title !== "Default") {
              wsTitle = win.title;
            } else {
              wsTitle = ws.title || "Workspace";
            }
          }

          list.push({
            id: ws.id || `${rootNode.id}-${win.id}-${ws.id}`,
            browserName,
            browserTitle,
            profileName,
            windowTitle: win.title || undefined,
            workspaceTitle: wsTitle,
            node: ws,
            tabCount: countTabs(ws),
          });
        }
      } else {
        // Window has direct tabs/folders without workspace nodes
        list.push({
          id: win.id || `${rootNode.id}-${win.id}`,
          browserName,
          browserTitle,
          profileName,
          windowTitle: win.title || undefined,
          workspaceTitle: win.title || "Main Window",
          node: {
            ...win,
            node_type: "workspace",
          },
          tabCount: countTabs(win),
        });
      }
    }
  } else {
    // No window children on rootNode. Check for workspace children directly.
    const workspaceChildren = (rootNode.children || []).filter(
      (c) => c.node_type === "workspace" && countTabs(c) > 0
    );

    if (workspaceChildren.length > 0) {
      for (const ws of workspaceChildren) {
        list.push({
          id: ws.id || `${rootNode.id}-${ws.id}`,
          browserName,
          browserTitle,
          profileName,
          workspaceTitle: ws.title || "Workspace",
          node: ws,
          tabCount: countTabs(ws),
        });
      }
    } else {
      // Root has direct tabs/folders
      list.push({
        id: `${rootNode.id}-workspace`,
        browserName,
        browserTitle,
        profileName,
        workspaceTitle: rootNode.title || "Personal",
        node: {
          ...rootNode,
          node_type: "workspace",
        },
        tabCount: countTabs(rootNode),
      });
    }
  }

  return list;
}
