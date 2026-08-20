import { describe, it, expect } from "bun:test";
import { countTabs, countWorkspaces, extractWorkspacesFromRoot } from "./treeUtils";
import type { BrowserTreeNode } from "./types";

describe("treeUtils - workspace extraction", () => {
  it("extracts each workspace as a separate card item for Arc Browser with multiple spaces", () => {
    const arcTree: BrowserTreeNode = {
      id: "arc-macos-default-root",
      browser_name: "arc",
      os_type: "macos",
      profile_name: "default",
      node_type: "root",
      title: "Arc Browser",
      url: null,
      parent_id: null,
      sort_order: 0,
      snapshot_time: "2026-08-20T10:00:00Z",
      children: [
        {
          id: "arc-default-win-default",
          browser_name: "arc",
          os_type: "macos",
          profile_name: "default",
          node_type: "window",
          title: "Main Window",
          url: null,
          parent_id: "arc-macos-default-root",
          sort_order: 0,
          snapshot_time: "2026-08-20T10:00:00Z",
          children: [
            {
              id: "arc-favorites",
              browser_name: "arc",
              os_type: "macos",
              profile_name: "default",
              node_type: "workspace",
              title: "Favorites",
              url: null,
              parent_id: "arc-default-win-default",
              sort_order: 0,
              snapshot_time: "2026-08-20T10:00:00Z",
              children: [
                {
                  id: "tab-1",
                  browser_name: "arc",
                  os_type: "macos",
                  profile_name: "default",
                  node_type: "tab",
                  title: "YouTube Music",
                  url: "https://music.youtube.com",
                  parent_id: "arc-favorites",
                  sort_order: 0,
                  snapshot_time: "2026-08-20T10:00:00Z",
                },
              ],
            },
            {
              id: "arc-space-oscar",
              browser_name: "arc",
              os_type: "macos",
              profile_name: "default",
              node_type: "workspace",
              title: "Oscar",
              url: null,
              parent_id: "arc-default-win-default",
              sort_order: 1,
              snapshot_time: "2026-08-20T10:00:00Z",
              theme_color: "#8ef1cc",
              theme_colors: ["#8ef1cc", "#95dff1", "#99f09e"],
              icon: "🐻",
              children: [
                {
                  id: "tab-2",
                  browser_name: "arc",
                  os_type: "macos",
                  profile_name: "default",
                  node_type: "tab",
                  title: "GitHub",
                  url: "https://github.com",
                  parent_id: "arc-space-oscar",
                  sort_order: 0,
                  snapshot_time: "2026-08-20T10:00:00Z",
                },
              ],
            },
            {
              id: "arc-space-test",
              browser_name: "arc",
              os_type: "macos",
              profile_name: "default",
              node_type: "workspace",
              title: "Test",
              url: null,
              parent_id: "arc-default-win-default",
              sort_order: 2,
              snapshot_time: "2026-08-20T10:00:00Z",
              theme_color: "#ffffff",
              theme_colors: ["#ffffff"],
              children: [
                {
                  id: "tab-3",
                  browser_name: "arc",
                  os_type: "macos",
                  profile_name: "default",
                  node_type: "tab",
                  title: "Google",
                  url: "https://google.com",
                  parent_id: "arc-space-test",
                  sort_order: 0,
                  snapshot_time: "2026-08-20T10:00:00Z",
                },
              ],
            },
          ],
        },
      ],
    };

    const workspaces = extractWorkspacesFromRoot(arcTree);
    expect(workspaces).toHaveLength(3);
    expect(workspaces[0].workspaceTitle).toBe("Favorites");
    expect(workspaces[0].tabCount).toBe(1);
    expect(workspaces[1].workspaceTitle).toBe("Oscar");
    expect(workspaces[1].tabCount).toBe(1);
    expect(workspaces[1].themeColor).toBe("#8ef1cc");
    expect(workspaces[1].themeColors).toEqual(["#8ef1cc", "#95dff1", "#99f09e"]);
    expect(workspaces[1].icon).toBe("🐻");
    expect(workspaces[2].workspaceTitle).toBe("Test");
    expect(workspaces[2].tabCount).toBe(1);
    expect(workspaces[2].themeColor).toBe("#ffffff");

    expect(countWorkspaces(arcTree)).toBe(3);
    expect(countTabs(arcTree)).toBe(3);
  });

  it("extracts multiple windows as separate cards when windows have default workspaces", () => {
    const chromeTree: BrowserTreeNode = {
      id: "chrome-macos-default-root",
      browser_name: "chrome",
      os_type: "macos",
      profile_name: "default",
      node_type: "root",
      title: "Chrome (default)",
      url: null,
      parent_id: null,
      sort_order: 0,
      snapshot_time: "2026-08-20T10:00:00Z",
      children: [
        {
          id: "chrome-win-1",
          browser_name: "chrome",
          os_type: "macos",
          profile_name: "default",
          node_type: "window",
          title: "Chrome Window 1",
          url: null,
          parent_id: "chrome-macos-default-root",
          sort_order: 0,
          snapshot_time: "2026-08-20T10:00:00Z",
          children: [
            {
              id: "chrome-ws-1",
              browser_name: "chrome",
              os_type: "macos",
              profile_name: "default",
              node_type: "workspace",
              title: "Default Workspace",
              url: null,
              parent_id: "chrome-win-1",
              sort_order: 0,
              snapshot_time: "2026-08-20T10:00:00Z",
              children: [
                {
                  id: "tab-c1",
                  browser_name: "chrome",
                  os_type: "macos",
                  profile_name: "default",
                  node_type: "tab",
                  title: "Vercel",
                  url: "https://vercel.com",
                  parent_id: "chrome-ws-1",
                  sort_order: 0,
                  snapshot_time: "2026-08-20T10:00:00Z",
                },
              ],
            },
          ],
        },
        {
          id: "chrome-win-2",
          browser_name: "chrome",
          os_type: "macos",
          profile_name: "default",
          node_type: "window",
          title: "Chrome Window 2",
          url: null,
          parent_id: "chrome-macos-default-root",
          sort_order: 1,
          snapshot_time: "2026-08-20T10:00:00Z",
          children: [
            {
              id: "chrome-ws-2",
              browser_name: "chrome",
              os_type: "macos",
              profile_name: "default",
              node_type: "workspace",
              title: "Default Workspace",
              url: null,
              parent_id: "chrome-win-2",
              sort_order: 0,
              snapshot_time: "2026-08-20T10:00:00Z",
              children: [
                {
                  id: "tab-c2",
                  browser_name: "chrome",
                  os_type: "macos",
                  profile_name: "default",
                  node_type: "tab",
                  title: "Next.js",
                  url: "https://nextjs.org",
                  parent_id: "chrome-ws-2",
                  sort_order: 0,
                  snapshot_time: "2026-08-20T10:00:00Z",
                },
              ],
            },
          ],
        },
      ],
    };

    const workspaces = extractWorkspacesFromRoot(chromeTree);
    expect(workspaces).toHaveLength(2);
    expect(workspaces[0].workspaceTitle).toBe("Chrome Window 1");
    expect(workspaces[1].workspaceTitle).toBe("Chrome Window 2");
  });
});
