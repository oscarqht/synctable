import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { serializeToArcSidebar } from "./arcSerializer";
import { parseArcSidebar } from "../parsers/arc";
import type { BrowserTreeNode } from "@synctable/ui";

test("ArcSerializer: serializes spaces, folders, split views, and tabs into StorableSidebar.json", () => {
  const directory = mkdtempSync(join(tmpdir(), "synctable-arc-serialize-"));
  const targetFilePath = join(directory, "StorableSidebar.json");

  const inputTree: BrowserTreeNode[] = [
    {
      id: "root-1",
      browser_name: "arc",
      os_type: "macos",
      profile_name: "Default",
      node_type: "root",
      title: "Arc Browser",
      url: null,
      parent_id: null,
      sort_order: 0,
      snapshot_time: "now",
      children: [
        {
          id: "ws-1",
          browser_name: "arc",
          os_type: "macos",
          profile_name: "Default",
          node_type: "workspace",
          title: "Engineering",
          theme_color: "#3366cc",
          icon: "💻",
          url: null,
          parent_id: "root-1",
          sort_order: 0,
          snapshot_time: "now",
          children: [
            {
              id: "pin-1",
              browser_name: "arc",
              os_type: "macos",
              profile_name: "Default",
              node_type: "pinned_tab",
              title: "Linear",
              url: "https://linear.app",
              parent_id: "ws-1",
              sort_order: 0,
              snapshot_time: "now",
            },
            {
              id: "folder-1",
              browser_name: "arc",
              os_type: "macos",
              profile_name: "Default",
              node_type: "folder",
              title: "Docs",
              url: null,
              parent_id: "ws-1",
              sort_order: 1,
              snapshot_time: "now",
              children: [
                {
                  id: "tab-1",
                  browser_name: "arc",
                  os_type: "macos",
                  profile_name: "Default",
                  node_type: "tab",
                  title: "MDN",
                  url: "https://developer.mozilla.org",
                  parent_id: "folder-1",
                  sort_order: 0,
                  snapshot_time: "now",
                },
              ],
            },
            {
              id: "split-1",
              browser_name: "arc",
              os_type: "macos",
              profile_name: "Default",
              node_type: "split_view",
              title: "Split View",
              url: null,
              parent_id: "ws-1",
              sort_order: 2,
              snapshot_time: "now",
              children: [
                {
                  id: "tab-2",
                  browser_name: "arc",
                  os_type: "macos",
                  profile_name: "Default",
                  node_type: "tab",
                  title: "GitHub API",
                  url: "https://api.github.com",
                  parent_id: "split-1",
                  sort_order: 0,
                  snapshot_time: "now",
                },
                {
                  id: "tab-3",
                  browser_name: "arc",
                  os_type: "macos",
                  profile_name: "Default",
                  node_type: "tab",
                  title: "Localhost",
                  url: "https://localhost:3000",
                  parent_id: "split-1",
                  sort_order: 1,
                  snapshot_time: "now",
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  const result = serializeToArcSidebar(inputTree, {
    targetFilePath,
    mode: "overwrite",
  });

  expect(result.success).toBe(true);
  expect(result.spacesCount).toBe(1);
  expect(result.tabsCount).toBe(4);

  // Roundtrip parse with Arc parser to verify compatibility
  const parsedNodes = parseArcSidebar({
    filePath: targetFilePath,
    osType: "macos",
    profileName: "Default",
    snapshotTime: "now",
  });

  expect(parsedNodes.some((n) => n.node_type === "workspace" && n.title === "Engineering")).toBe(true);
  expect(parsedNodes.some((n) => n.node_type === "folder" && n.title === "Docs")).toBe(true);
  expect(parsedNodes.some((n) => n.node_type === "split_view")).toBe(true);
  expect(parsedNodes.some((n) => n.url === "https://linear.app")).toBe(true);
  expect(parsedNodes.some((n) => n.url === "https://developer.mozilla.org")).toBe(true);
  expect(parsedNodes.some((n) => n.url === "https://api.github.com")).toBe(true);
  expect(parsedNodes.some((n) => n.url === "https://localhost:3000")).toBe(true);
});
