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
  let count = 0;
  if (node.node_type === "workspace" && countTabs(node) > 0) {
    count++;
  }
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      count += countWorkspaces(child);
    }
  }
  return count;
}
