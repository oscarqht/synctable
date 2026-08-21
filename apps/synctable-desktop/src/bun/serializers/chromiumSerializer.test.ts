import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { serializeToChromiumSession } from "./chromiumSerializer";
import { parseChromePreferences } from "../parsers/chrome";
import { parseVivaldiPreferences } from "../parsers/vivaldi";
import type { BrowserTreeNode } from "@synctable/ui";

test("ChromiumSerializer: serializes spaces, tab groups, split views, and tabs for Chrome", () => {
  const profileDir = mkdtempSync(join(tmpdir(), "synctable-chrome-serialize-"));

  const inputTree: BrowserTreeNode[] = [
    {
      id: "root-1",
      browser_name: "chrome",
      os_type: "macos",
      profile_name: "Default",
      node_type: "root",
      title: "Google Chrome",
      url: null,
      parent_id: null,
      sort_order: 0,
      snapshot_time: "now",
      children: [
        {
          id: "ws-1",
          browser_name: "chrome",
          os_type: "macos",
          profile_name: "Default",
          node_type: "workspace",
          title: "Main Workspace",
          url: null,
          parent_id: "root-1",
          sort_order: 0,
          snapshot_time: "now",
          children: [
            {
              id: "pin-1",
              browser_name: "chrome",
              os_type: "macos",
              profile_name: "Default",
              node_type: "pinned_tab",
              title: "Google",
              url: "https://google.com",
              parent_id: "ws-1",
              sort_order: 0,
              snapshot_time: "now",
            },
            {
              id: "folder-1",
              browser_name: "chrome",
              os_type: "macos",
              profile_name: "Default",
              node_type: "folder",
              title: "Productivity",
              url: null,
              parent_id: "ws-1",
              sort_order: 1,
              snapshot_time: "now",
              children: [
                {
                  id: "tab-1",
                  browser_name: "chrome",
                  os_type: "macos",
                  profile_name: "Default",
                  node_type: "tab",
                  title: "Notion",
                  url: "https://notion.so",
                  parent_id: "folder-1",
                  sort_order: 0,
                  snapshot_time: "now",
                },
              ],
            },
            {
              id: "split-1",
              browser_name: "chrome",
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
                  browser_name: "chrome",
                  os_type: "macos",
                  profile_name: "Default",
                  node_type: "tab",
                  title: "Docs",
                  url: "https://docs.google.com",
                  parent_id: "split-1",
                  sort_order: 0,
                  snapshot_time: "now",
                },
                {
                  id: "tab-3",
                  browser_name: "chrome",
                  os_type: "macos",
                  profile_name: "Default",
                  node_type: "tab",
                  title: "Sheets",
                  url: "https://sheets.google.com",
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

  const result = serializeToChromiumSession(inputTree, {
    profilePath: profileDir,
    browserName: "chrome",
    mode: "overwrite",
  });

  expect(result.success).toBe(true);
  expect(result.spacesCount).toBe(1);
  expect(result.tabsCount).toBe(4);

  // Check generated files
  const sessionsDir = join(profileDir, "Sessions");
  const sessionFiles = readdirSync(sessionsDir).filter((f) => f.startsWith("Session_"));
  expect(sessionFiles.length).toBe(1);
  const sessionPath = join(sessionsDir, sessionFiles[0]);

  const prefPath = join(profileDir, "Preferences");
  const prefData = JSON.parse(readFileSync(prefPath, "utf8"));
  expect(prefData.session.restore_on_startup).toBe(1);

  // Roundtrip parse with Chrome parser
  const parsedNodes = parseChromePreferences({
    filePath: prefPath,
    sessionFilePath: sessionPath,
    osType: "macos",
    profileName: "Default",
    snapshotTime: "now",
  });

  expect(parsedNodes.some((n) => n.node_type === "folder" && n.title === "Productivity")).toBe(true);
  expect(parsedNodes.some((n) => n.node_type === "split_view")).toBe(true);
  expect(parsedNodes.some((n) => n.url === "https://google.com")).toBe(true);
  expect(parsedNodes.some((n) => n.url === "https://notion.so")).toBe(true);
  expect(parsedNodes.some((n) => n.url === "https://docs.google.com")).toBe(true);
  expect(parsedNodes.some((n) => n.url === "https://sheets.google.com")).toBe(true);
});

test("ChromiumSerializer: serializes workspaces, tab stacks, and split tiling for Vivaldi", () => {
  const profileDir = mkdtempSync(join(tmpdir(), "synctable-vivaldi-serialize-"));

  const inputTree: BrowserTreeNode[] = [
    {
      id: "root-1",
      browser_name: "vivaldi",
      os_type: "macos",
      profile_name: "Default",
      node_type: "root",
      title: "Vivaldi",
      url: null,
      parent_id: null,
      sort_order: 0,
      snapshot_time: "now",
      children: [
        {
          id: "ws-1",
          browser_name: "vivaldi",
          os_type: "macos",
          profile_name: "Default",
          node_type: "workspace",
          title: "Engineering",
          url: null,
          parent_id: "root-1",
          sort_order: 0,
          snapshot_time: "now",
          children: [
            {
              id: "pin-1",
              browser_name: "vivaldi",
              os_type: "macos",
              profile_name: "Default",
              node_type: "pinned_tab",
              title: "Vivaldi",
              url: "https://vivaldi.com",
              parent_id: "ws-1",
              sort_order: 0,
              snapshot_time: "now",
            },
            {
              id: "folder-1",
              browser_name: "vivaldi",
              os_type: "macos",
              profile_name: "Default",
              node_type: "folder",
              title: "Dev Stack",
              url: null,
              parent_id: "ws-1",
              sort_order: 1,
              snapshot_time: "now",
              children: [
                {
                  id: "split-1",
                  browser_name: "vivaldi",
                  os_type: "macos",
                  profile_name: "Default",
                  node_type: "split_view",
                  title: "Split View",
                  url: null,
                  parent_id: "folder-1",
                  sort_order: 0,
                  snapshot_time: "now",
                  children: [
                    {
                      id: "tab-1",
                      browser_name: "vivaldi",
                      os_type: "macos",
                      profile_name: "Default",
                      node_type: "tab",
                      title: "Vivaldi Forum",
                      url: "https://forum.vivaldi.net",
                      parent_id: "split-1",
                      sort_order: 0,
                      snapshot_time: "now",
                    },
                    {
                      id: "tab-2",
                      browser_name: "vivaldi",
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
      ],
    },
  ];

  const result = serializeToChromiumSession(inputTree, {
    profilePath: profileDir,
    browserName: "vivaldi",
    mode: "overwrite",
  });

  expect(result.success).toBe(true);
  expect(result.spacesCount).toBe(1);
  expect(result.tabsCount).toBe(3);

  // Check generated files
  const sessionsDir = join(profileDir, "Sessions");
  const sessionFiles = readdirSync(sessionsDir).filter((f) => f.startsWith("Session_"));
  expect(sessionFiles.length).toBe(1);
  const sessionPath = join(sessionsDir, sessionFiles[0]);

  const prefPath = join(profileDir, "Preferences");
  const prefData = JSON.parse(readFileSync(prefPath, "utf8"));
  expect(prefData.vivaldi?.workspaces?.list?.length).toBe(1);
  expect(prefData.vivaldi?.workspaces?.list?.[0]?.name).toBe("Engineering");

  // Roundtrip parse with Vivaldi parser
  const parsedNodes = parseVivaldiPreferences({
    filePath: prefPath,
    sessionFilePath: sessionPath,
    osType: "macos",
    profileName: "Default",
    snapshotTime: "now",
  });

  expect(parsedNodes.some((n) => n.node_type === "workspace" && n.title === "Engineering")).toBe(true);
  expect(parsedNodes.some((n) => n.node_type === "folder" && n.title === "Dev Stack")).toBe(true);
  expect(parsedNodes.some((n) => n.node_type === "split_view")).toBe(true);
  expect(parsedNodes.some((n) => n.url === "https://vivaldi.com")).toBe(true);
  expect(parsedNodes.some((n) => n.url === "https://forum.vivaldi.net")).toBe(true);
  expect(parsedNodes.some((n) => n.url === "https://github.com")).toBe(true);
});
