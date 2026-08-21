import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { serializeToZenSession, decompressMozLz4 } from "./zenSerializer";
import { parseZenSessionstore } from "../parsers/zen";
import type { BrowserTreeNode } from "@synctable/ui";

test("ZenSerializer: serializes spaces, folders, split views, and tabs into recovery.jsonlz4", () => {
  const profileDir = mkdtempSync(join(tmpdir(), "synctable-zen-serialize-"));

  const inputTree: BrowserTreeNode[] = [
    {
      id: "root-1",
      browser_name: "zen",
      os_type: "macos",
      profile_name: "Default",
      node_type: "root",
      title: "Zen Browser",
      url: null,
      parent_id: null,
      sort_order: 0,
      snapshot_time: "now",
      children: [
        {
          id: "ws-1",
          browser_name: "zen",
          os_type: "macos",
          profile_name: "Default",
          node_type: "workspace",
          title: "Research",
          theme_color: "#10b981",
          icon: "🔬",
          url: null,
          parent_id: "root-1",
          sort_order: 0,
          snapshot_time: "now",
          children: [
            {
              id: "pin-1",
              browser_name: "zen",
              os_type: "macos",
              profile_name: "Default",
              node_type: "pinned_tab",
              title: "Zen Browser",
              url: "https://zen-browser.app",
              parent_id: "ws-1",
              sort_order: 0,
              snapshot_time: "now",
            },
            {
              id: "folder-1",
              browser_name: "zen",
              os_type: "macos",
              profile_name: "Default",
              node_type: "folder",
              title: "AI Papers",
              url: null,
              parent_id: "ws-1",
              sort_order: 1,
              snapshot_time: "now",
              children: [
                {
                  id: "tab-1",
                  browser_name: "zen",
                  os_type: "macos",
                  profile_name: "Default",
                  node_type: "tab",
                  title: "ArXiv",
                  url: "https://arxiv.org",
                  parent_id: "folder-1",
                  sort_order: 0,
                  snapshot_time: "now",
                },
              ],
            },
            {
              id: "split-1",
              browser_name: "zen",
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
                  browser_name: "zen",
                  os_type: "macos",
                  profile_name: "Default",
                  node_type: "tab",
                  title: "Hugging Face",
                  url: "https://huggingface.co",
                  parent_id: "split-1",
                  sort_order: 0,
                  snapshot_time: "now",
                },
                {
                  id: "tab-3",
                  browser_name: "zen",
                  os_type: "macos",
                  profile_name: "Default",
                  node_type: "tab",
                  title: "GitHub",
                  url: "https://github.com",
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

  const result = serializeToZenSession(inputTree, {
    profilePath: profileDir,
    mode: "overwrite",
  });

  expect(result.success).toBe(true);
  expect(result.spacesCount).toBe(1);
  expect(result.tabsCount).toBe(4);

  // Read generated recovery.jsonlz4
  const recoveryPath = join(profileDir, "sessionstore-backups", "recovery.jsonlz4");
  const raw = readFileSync(recoveryPath);
  const json = decompressMozLz4(raw);

  expect(json.windows?.[0]?.spaces?.length).toBe(1);
  expect(json.windows?.[0]?.spaces?.[0]?.name).toBe("Research");
  expect(json.windows?.[0]?.folders?.length).toBe(2); // 1 folder + 1 split view group
  expect(json.windows?.[0]?.tabs?.length).toBe(4);

  // Roundtrip parse using synctable Zen parser
  const parsedNodes = parseZenSessionstore({
    filePath: recoveryPath,
    osType: "macos",
    profileName: "Default",
    snapshotTime: "now",
  });

  expect(parsedNodes.some((n) => n.node_type === "workspace" && n.title === "Research")).toBe(true);
  expect(parsedNodes.some((n) => n.node_type === "folder" && n.title === "AI Papers")).toBe(true);
  expect(parsedNodes.some((n) => n.node_type === "split_view")).toBe(true);
  expect(parsedNodes.some((n) => n.url === "https://zen-browser.app")).toBe(true);
  expect(parsedNodes.some((n) => n.url === "https://arxiv.org")).toBe(true);
  expect(parsedNodes.some((n) => n.url === "https://huggingface.co")).toBe(true);
  expect(parsedNodes.some((n) => n.url === "https://github.com")).toBe(true);
});
