import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { extractWorkspacesFromRoot, isValidHttpUrl, type BrowserTreeNode } from "@synctable/ui";

export interface ArcSerializerOptions {
  targetFilePath: string;
  mode?: "merge" | "overwrite";
}

function hexToRgb01(hexStr: string | null | undefined): { r: number; g: number; b: number } | null {
  if (!hexStr || !hexStr.startsWith("#")) return null;
  const hex = hexStr.replace("#", "");
  if (hex.length !== 6 && hex.length !== 8) return null;
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  return { r: Math.round(r * 1000) / 1000, g: Math.round(g * 1000) / 1000, b: Math.round(b * 1000) / 1000 };
}

export function serializeToArcSidebar(
  nodes: BrowserTreeNode[],
  options: ArcSerializerOptions
): { success: boolean; spacesCount: number; tabsCount: number; error?: string } {
  try {
    const { targetFilePath, mode = "merge" } = options;

    let existingData: any = null;
    if (existsSync(targetFilePath)) {
      try {
        existingData = JSON.parse(readFileSync(targetFilePath, "utf-8"));
      } catch (err) {
        console.warn("[ArcSerializer] Failed to parse existing StorableSidebar.json, creating new structure:", err);
      }
    }

    if (!existingData || typeof existingData !== "object") {
      existingData = {
        version: 1,
        sidebar: {
          containers: [
            { global: {} },
            { spaces: [], items: [], topAppsContainerIDs: [] },
          ],
        },
      };
    }

    if (!Array.isArray(existingData.sidebar?.containers) || existingData.sidebar.containers.length < 2) {
      existingData.sidebar = {
        containers: [
          { global: {} },
          { spaces: [], items: [], topAppsContainerIDs: [] },
        ],
      };
    }

    const container = existingData.sidebar.containers[1];
    if (!Array.isArray(container.spaces)) container.spaces = [];
    if (!Array.isArray(container.items)) container.items = [];
    if (!Array.isArray(container.topAppsContainerIDs)) container.topAppsContainerIDs = [];

    if (mode === "overwrite") {
      container.spaces = [];
      container.items = [];
    }

    // Extract all workspaces from input nodes
    const workspaces = nodes.flatMap(extractWorkspacesFromRoot);
    if (workspaces.length === 0 && nodes.length > 0) {
      // Fallback if nodes don't form standard root
      workspaces.push({
        id: randomUUID(),
        browserName: "imported",
        browserTitle: "Imported Workspace",
        profileName: "Default",
        workspaceTitle: "Restored Space",
        node: {
          id: randomUUID(),
          browser_name: "arc",
          os_type: "macos",
          profile_name: "Default",
          node_type: "workspace",
          title: "Restored Space",
          url: null,
          parent_id: null,
          sort_order: 0,
          snapshot_time: new Date().toISOString(),
          children: nodes,
        },
        tabCount: nodes.length,
      });
    }

    let totalTabs = 0;

    for (const ws of workspaces) {
      const spaceUUID = randomUUID();
      const pinnedContainerUUID = randomUUID();
      const unpinnedContainerUUID = randomUUID();

      const pinnedItemIds: string[] = [];
      const unpinnedItemIds: string[] = [];

      const newItemsMap = new Map<string, any>();

      function processNode(node: BrowserTreeNode, parentContainerUUID: string, isPinnedSection: boolean): string | null {
        if (!node) return null;

        if (node.node_type === "folder") {
          const folderUUID = randomUUID();
          const folderChildrenIds: string[] = [];

          if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
              const childId = processNode(child, folderUUID, isPinnedSection);
              if (childId) folderChildrenIds.push(childId);
            }
          }

          if (folderChildrenIds.length === 0) return null;

          newItemsMap.set(folderUUID, {
            id: folderUUID,
            parentID: parentContainerUUID,
            title: node.title || "Folder",
            childrenIds: folderChildrenIds,
            createdAt: Date.now() / 1000,
            data: {
              tabGroup: {
                title: node.title || "Folder",
              },
            },
          });
          return folderUUID;
        }

        if (node.node_type === "split_view") {
          const splitUUID = randomUUID();
          const splitChildIds: string[] = [];

          if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
              if (isValidHttpUrl(child.url)) {
                const tabUUID = randomUUID();
                totalTabs++;
                newItemsMap.set(tabUUID, {
                  id: tabUUID,
                  parentID: splitUUID,
                  title: child.title || child.url || "Tab",
                  childrenIds: [],
                  createdAt: Date.now() / 1000,
                  data: {
                    tab: {
                      savedURL: child.url,
                      savedTitle: child.title || child.url,
                      pinned: false,
                    },
                  },
                });
                splitChildIds.push(tabUUID);
              }
            }
          }

          if (splitChildIds.length === 0) return null;

          const widthFraction = Math.round((1 / splitChildIds.length) * 1000) / 1000;
          const itemWidthFactors: (string | number)[] = [];
          for (const cid of splitChildIds) {
            itemWidthFactors.push(cid, widthFraction);
          }

          newItemsMap.set(splitUUID, {
            id: splitUUID,
            parentID: parentContainerUUID,
            title: node.title || "Split View",
            childrenIds: splitChildIds,
            createdAt: Date.now() / 1000,
            data: {
              splitView: {
                itemWidthFactors,
                layoutOrientation: "horizontal",
                focusItemID: splitChildIds[0],
              },
            },
          });
          return splitUUID;
        }

        if ((node.node_type === "tab" || node.node_type === "pinned_tab") && isValidHttpUrl(node.url)) {
          const tabUUID = randomUUID();
          totalTabs++;
          newItemsMap.set(tabUUID, {
            id: tabUUID,
            parentID: parentContainerUUID,
            title: node.title || node.url || "Tab",
            childrenIds: [],
            createdAt: Date.now() / 1000,
            data: {
              tab: {
                savedURL: node.url,
                savedTitle: node.title || node.url,
                pinned: isPinnedSection || node.node_type === "pinned_tab",
              },
            },
          });
          return tabUUID;
        }

        return null;
      }

      // Traverse workspace children
      const wsChildren = ws.node.children || [];
      for (const child of wsChildren) {
        if (child.node_type === "pinned_tab") {
          const id = processNode(child, pinnedContainerUUID, true);
          if (id) pinnedItemIds.push(id);
        } else {
          const id = processNode(child, unpinnedContainerUUID, false);
          if (id) unpinnedItemIds.push(id);
        }
      }

      // Add pinned and unpinned containers
      newItemsMap.set(pinnedContainerUUID, {
        id: pinnedContainerUUID,
        parentID: spaceUUID,
        childrenIds: pinnedItemIds,
        data: { itemContainer: {} },
      });

      newItemsMap.set(unpinnedContainerUUID, {
        id: unpinnedContainerUUID,
        parentID: spaceUUID,
        childrenIds: unpinnedItemIds,
        data: { itemContainer: {} },
      });

      // Build theme info
      const rgb = hexToRgb01(ws.themeColor || ws.themeColors?.[0]);
      const windowTheme = rgb
        ? {
            background: {
              singleColor: {
                r: rgb.r,
                g: rgb.g,
                b: rgb.b,
              },
            },
          }
        : null;

      const customInfo: any = {};
      if (windowTheme) customInfo.windowTheme = windowTheme;
      if (ws.icon) customInfo.iconType = { emoji: ws.icon };

      const spaceObject = {
        id: spaceUUID,
        title: ws.workspaceTitle || "Restored Space",
        customInfo: Object.keys(customInfo).length > 0 ? customInfo : null,
        containerIDs: [
          "pinned",
          pinnedContainerUUID,
          "unpinned",
          unpinnedContainerUUID,
        ],
      };

      // Append space to container.spaces (alternating [id, spaceObject])
      container.spaces.push(spaceUUID, spaceObject);

      // Append items to container.items (alternating [id, itemObject])
      for (const [itemId, itemObj] of newItemsMap.entries()) {
        container.items.push(itemId, itemObj);
      }
    }

    writeFileSync(targetFilePath, JSON.stringify(existingData, null, 2), "utf-8");

    return {
      success: true,
      spacesCount: workspaces.length,
      tabsCount: totalTabs,
    };
  } catch (err: any) {
    return {
      success: false,
      spacesCount: 0,
      tabsCount: 0,
      error: err?.message || String(err),
    };
  }
}
